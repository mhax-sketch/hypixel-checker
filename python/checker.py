import sys
import json
import requests
import uuid
import time
import re
from minecraft.networking.connection import Connection
from minecraft.authentication import AuthenticationToken, Profile
from minecraft.networking.packets import clientbound

def get_mc_profile(token):
    url = "https://api.minecraftservices.com/minecraft/profile"
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(url, headers=headers)
    r.raise_for_status()
    data = r.json()
    return data["name"], data["id"]

def extract_text_from_components(json_data):
    """Recursively extract text from Minecraft JSON chat components."""
    text = ''
    if isinstance(json_data, dict):
        text += json_data.get('text', '')
        if 'extra' in json_data:
            for component in json_data['extra']:
                text += extract_text_from_components(component)
    elif isinstance(json_data, list):
        for component in json_data:
            text += extract_text_from_components(component)
    elif isinstance(json_data, str):
        text += json_data
    return text

def parse_ban_info(full_text):
    """Parse ban reason, time left, and ban ID from the full disconnect text."""
    reason = "Unknown"
    time_left = "Permanent"
    ban_id = "N/A"

    full_text = re.sub(r'Â§.', '', full_text)  # Remove legacy color codes
    lines = [line.strip() for line in full_text.split('\n') if line.strip()]

    # Look for Hypixel's format: "25d 21h 4m 46s" or similar
    duration_match = re.search(r'(\d+d\s+\d+h\s+\d+m\s+\d+s|\d+d\s+\d+h|\d+h\s+\d+m|\d+d)', full_text)
    if duration_match:
        time_left = duration_match.group(1).strip()
    elif 'permanently' in full_text.lower():
        time_left = 'Permanent'
    elif 'temporarily' in full_text.lower():
        time_left = 'Temporary (duration unknown)'

    reason_lines = []
    in_reason = False

    for line in lines:
        lower_line = line.lower()
        
        if lower_line.startswith('reason:'):
            reason = line.split(':', 1)[1].strip()
            in_reason = True
        elif in_reason:
            if lower_line.startswith('ban id:') or lower_line.startswith('find out more:') or lower_line.startswith('sharing your ban id'):
                in_reason = False
            else:
                reason_lines.append(line)
        if lower_line.startswith('ban id:'):
            ban_id = line.split(':', 1)[1].strip()

    if reason_lines:
        reason += ' ' + ' '.join(reason_lines)

    if reason == "Unknown" and lines:
        for i, line in enumerate(lines):
            if 'banned' in line.lower():
                reason = ' '.join(lines[i+1:]) if i+1 < len(lines) else line
                break

    if 'suspicious activity' in full_text.lower():
        time_left = 'N/A'

    return reason.strip(), time_left, ban_id

def check_hypixel_ban(mc_name, mc_uuid, mc_token):
    result = {"status": None, "reason": None, "time_left": None, "ban_id": None}
    disconnect_json = None
    auth_token = AuthenticationToken(username=mc_name, access_token=mc_token, client_token=uuid.uuid4().hex)
    auth_token.profile = Profile(id_=mc_uuid, name=mc_name)
    
    try:
        connection = Connection("mc.hypixel.net", 25565, auth_token=auth_token, initial_version=47, allowed_versions={47})

        @connection.listener(clientbound.login.DisconnectPacket, early=True)
        def login_disconnect(packet):
            nonlocal disconnect_json
            disconnect_json = packet.json_data

        @connection.listener(clientbound.play.JoinGamePacket, early=True)
        def joined_server(packet):
            nonlocal result
            result["status"] = "unbanned"

        connection.connect()
        c = 0
        while result["status"] is None and c < 800:
            time.sleep(0.01)
            c += 1

        if result["status"] == "unbanned":
            result["reason"] = "N/A"
            result["time_left"] = "N/A"
            result["ban_id"] = "N/A"
        elif disconnect_json is not None:
            if isinstance(disconnect_json, str):
                try: 
                    disconnect_json = json.loads(disconnect_json)
                except: 
                    disconnect_json = {"text": disconnect_json}
            
            full_text = extract_text_from_components(disconnect_json)
            
            # Debug: Save to file
            try:
                with open("ban_message_debug.txt", "w", encoding="utf-8") as f:
                    f.write("=== RAW TEXT ===\n")
                    f.write(full_text)
                    f.write("\n\n=== JSON STRUCTURE ===\n")
                    f.write(json.dumps(disconnect_json, indent=2))
            except:
                pass
            
            result["reason"], result["time_left"], result["ban_id"] = parse_ban_info(full_text)
            result["status"] = "banned"
        else:
            result["status"] = "timeout"
        
        try:
            connection.disconnect()
        except:
            pass
    except Exception as e:
        result["status"] = "error"
        result["reason"] = str(e)
    
    return result

if __name__ == "__main__":
    try:
        token = sys.argv[1]
        proxy_type = sys.argv[2]
        
        mc_name, mc_uuid = get_mc_profile(token)
        hyp_result = check_hypixel_ban(mc_name, mc_uuid, token)
        
        output = {
            "mc_name": mc_name,
            "mc_uuid": mc_uuid,
            "status": hyp_result["status"],
            "reason": hyp_result["reason"],
            "time_left": hyp_result["time_left"],
            "ban_id": hyp_result["ban_id"]
        }
        
        print(json.dumps(output))
        sys.stdout.flush()
    except Exception as e:
        import traceback
        error_output = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output))
        sys.stdout.flush()
        sys.exit(1)
        