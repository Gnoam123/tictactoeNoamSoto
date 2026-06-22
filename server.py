# -*- coding: utf-8 -*-
import asyncio
import websockets
import json
import pyodbc
import os

DB_PATH = os.path.abspath("Database.accdb")
CONN_STR = rf'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={DB_PATH};'

clients = set()
# connected_players ישמור עכשיו גם האם המשתמש נמצא בפועל במצב אונליין
connected_players = {} 
available_roles = ["X", "O"] 
game_settings = {"rows": 3, "cols": 3, "winLength": 3} 

def check_login(username, password):
    try:
        conn = pyodbc.connect(CONN_STR)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))
        row = cursor.fetchone()
        conn.close()
        return row is not None
    except Exception as e:
        print("Database Error (Login):", e)
        return False

def save_game_to_db(user1, user2, winner):
    try:
        conn = pyodbc.connect(CONN_STR)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO games (user1, user2, winner) VALUES (?, ?, ?)", (user1, user2, winner))
        conn.commit()
        conn.close()
        print(f"Game saved! {user1} VS {user2}. Winner: {winner}")
    except Exception as e:
        print("Database Error (Save Game):", e)

def get_all_users():
    try:
        conn = pyodbc.connect(CONN_STR)
        cursor = conn.cursor()
        # שולפים רק שמות משתמש כדי לשמור על אבטחת סיסמאות
        cursor.execute("SELECT username FROM users")
        rows = cursor.fetchall()
        conn.close()
        return [row[0] for row in rows]
    except Exception as e:
        print("Database Error (Get Users):", e)
        return []

def get_all_games():
    try:
        conn = pyodbc.connect(CONN_STR)
        cursor = conn.cursor()
        cursor.execute("SELECT user1, user2, winner FROM games")
        rows = cursor.fetchall()
        conn.close()
        return [{"user1": r[0], "user2": r[1], "winner": r[2]} for r in rows]
    except Exception as e:
        print("Database Error (Get Games):", e)
        return []

async def broadcast_game_state():
    """משדר את תחילת המשחק רק לשחקנים שנמצאים בתוך מצב אונליין"""
    x_user = next((info["username"] for info in connected_players.values() if info.get("role") == "X" and info.get("in_online")), None)
    o_user = next((info["username"] for info in connected_players.values() if info.get("role") == "O" and info.get("in_online")), None)
    
    if x_user and o_user:
        start_msg = json.dumps({
            "action": "start_game",
            "playerX": x_user,
            "playerO": o_user,
            "settings": game_settings
        })
        for ws, p in connected_players.items():
            if p.get("in_online"):
                await ws.send(start_msg)

async def handler(ws):
    clients.add(ws)
    print(f"Client Connected! | Total Clients: {len(clients)}")
    try:
        async for message in ws:
            try:
                data = json.loads(message)
                if isinstance(data, dict) and "action" in data:
                    action = data["action"]
                    
                    # --- התחברות בסיסית בלבד ---
                    if action == "login":
                        success = check_login(data["username"], data["password"])
                        is_admin = (data["username"] == "noam123") # בדיקת מנהל
                        
                        if success:
                            connected_players[ws] = {"username": data["username"], "role": None, "in_online": False}
                        
                        await ws.send(json.dumps({
                            "action": "login_response", 
                            "success": success, 
                            "username": data["username"],
                            "is_admin": is_admin
                        }))
                        continue
                    
                    # --- בקשות פאנל מנהל ---
                    elif action == "get_users":
                        if ws in connected_players and connected_players[ws]["username"] == "noam123":
                            users = get_all_users()
                            await ws.send(json.dumps({"action": "admin_users_data", "data": users}))
                        continue

                    elif action == "get_games":
                        if ws in connected_players and connected_players[ws]["username"] == "noam123":
                            games = get_all_games()
                            await ws.send(json.dumps({"action": "admin_games_data", "data": games}))
                        continue
                    
                    # --- הצטרפות אקטיבית למצב אונליין ---
                    elif action == "join_online":
                        if ws in connected_players and not connected_players[ws]["in_online"]:
                            connected_players[ws]["in_online"] = True
                            role = None
                            if available_roles:
                                role = available_roles.pop(0)
                                connected_players[ws]["role"] = role
                            else:
                                role = "Spectator"
                                connected_players[ws]["role"] = role
                            
                            await ws.send(json.dumps({"action": "role_assigned", "role": role, "settings": game_settings}))
                            await broadcast_game_state()
                        continue

                    # --- יציאה ממצב אונליין לטובת AI/Local ---
                    elif action == "leave_online":
                        if ws in connected_players and connected_players[ws]["in_online"]:
                            connected_players[ws]["in_online"] = False
                            role_freed = connected_players[ws]["role"]
                            connected_players[ws]["role"] = None
                            
                            if role_freed in ["X", "O"]:
                                available_roles.append(role_freed)
                                available_roles.sort(reverse=True) # מבטיח ש-X יחולק שוב לפני O
                                
                                # מעדכן את השחקנים שנשארו באונליין
                                for client, p in connected_players.items():
                                    if client != ws and p.get("in_online"):
                                        await client.send(json.dumps({"action": "player_disconnected", "role": role_freed}))
                        continue
                    
                    # --- עדכון הגדרות (רק X יכול לשנות) ---
                    elif action == "update_settings":
                        if ws in connected_players and connected_players[ws].get("role") == "X":
                            game_settings["rows"] = data.get("rows", 3)
                            game_settings["cols"] = data.get("cols", 3)
                            game_settings["winLength"] = data.get("winLength", 3)
                            
                            update_msg = json.dumps({
                                "action": "update_settings",
                                "settings": game_settings
                            })
                            # שולחים לכולם באונליין כדי שיסתנכרנו
                            for client, p in connected_players.items():
                                if client != ws and p.get("in_online"):
                                    await client.send(update_msg)
                        continue
                    
                    # --- שמירת משחק ---
                    elif action == "save_game":
                        save_game_to_db(data["user1"], data["user2"], data["winner"])
                        continue
                    
                    # --- ניהול מהלכים ---
                    elif action == "move":
                        # בדיקה האם יש באמת 2 שחקנים אונליין
                        x_present = any(p.get("role") == "X" and p.get("in_online") for p in connected_players.values())
                        o_present = any(p.get("role") == "O" and p.get("in_online") for p in connected_players.values())
                        
                        if not (x_present and o_present):
                            await ws.send(json.dumps({
                                "action": "error",
                                "message": "השחקן השני אינו מחובר. אי אפשר לשחק לבד."
                            }))
                            continue
                            
                        # מעבירים את המהלך
                        for client, p in connected_players.items():
                            if client != ws and p.get("in_online"):
                                await client.send(message)
                        continue

            except json.JSONDecodeError:
                pass 
            
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        clients.remove(ws)
        if ws in connected_players:
            # שחרור התפקיד גם במקרה של סגירת חלון (ניתוק כפוי)
            if connected_players[ws].get("in_online"):
                role_freed = connected_players[ws].get("role")
                if role_freed in ["X", "O"]:
                    available_roles.append(role_freed)
                    available_roles.sort(reverse=True)
                    for client, p in connected_players.items():
                        if client != ws and p.get("in_online"):
                            asyncio.create_task(client.send(json.dumps({"action": "player_disconnected", "role": role_freed})))
            del connected_players[ws]
        print(f"Client Disconnected! | Total Clients: {len(clients)}")

async def main():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket & DB Server running on: ws://localhost:8765")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
