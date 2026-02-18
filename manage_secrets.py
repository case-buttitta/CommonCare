import os
import sys
import base64
import getpass
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# Configuration
SECRETS_FILE = 'secrets.enc'
ENV_FILE = '.env'
# In a real scenario, you might want to salt this differently or store the salt, 
# but for this simple use case we'll use a fixed salt or generate one and prepend it.
# Let's use a fixed salt for simplicity as requested "password is this possible".
# A fixed salt means rainbow table attacks are possible if the password is weak, 
# but "2kiwis" is already known.
SALT = b'commoncare_salt_' 

def derive_key(password):
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=SALT,
        iterations=480000,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))

def encrypt(password):
    if not os.path.exists(ENV_FILE):
        print(f"Error: {ENV_FILE} not found.")
        return

    with open(ENV_FILE, 'rb') as f:
        data = f.read()

    key = derive_key(password)
    f = Fernet(key)
    encrypted_data = f.encrypt(data)

    with open(SECRETS_FILE, 'wb') as f:
        f.write(encrypted_data)
    
    print(f"✓ Encrypted {ENV_FILE} to {SECRETS_FILE}")

def decrypt(password):
    if not os.path.exists(SECRETS_FILE):
        print(f"Error: {SECRETS_FILE} not found.")
        return

    with open(SECRETS_FILE, 'rb') as f:
        encrypted_data = f.read()

    try:
        key = derive_key(password)
        f = Fernet(key)
        decrypted_data = f.decrypt(encrypted_data)

        with open(ENV_FILE, 'wb') as f:
            f.write(decrypted_data)
        
        print(f"✓ Decrypted {SECRETS_FILE} to {ENV_FILE}")
    except Exception as e:
        print("Error: Decryption failed. Wrong password?")
        # print(e) # Uncomment for debugging

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ['encrypt', 'decrypt']:
        print("Usage: python manage_secrets.py [encrypt|decrypt]")
        sys.exit(1)

    command = sys.argv[1]
    
    # You can pass password as env var or input
    password = os.environ.get('SECRETS_PASSWORD')
    if not password:
         password = getpass.getpass("Enter password: ")

    if command == 'encrypt':
        encrypt(password)
    elif command == 'decrypt':
        decrypt(password)
