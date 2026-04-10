"""
Encrypt / Decrypt the .env file with a password.

Usage:
  python setup_env.py encrypt          # .env  -> .env.enc  (commit this)
  python setup_env.py decrypt          # .env.enc -> .env   (local use)
  python setup_env.py decrypt --force  # overwrite existing .env

The password is derived via PBKDF2 so the .env.enc file is safe to commit.
"""

import sys
import os
import base64
import hashlib
from pathlib import Path

# ── The password is baked in so any teammate can run the script ──────────
PASSWORD = "twokiwis"

# Fixed salt (deterministic key derivation – fine for a shared dev secret)
SALT = b"commoncare-env-salt-2024"

ENV_FILE = Path(__file__).parent / ".env"
ENC_FILE = Path(__file__).parent / ".env.enc"


def _derive_key(password: str) -> bytes:
    """Derive a 32-byte Fernet key from the password using PBKDF2."""
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=SALT,
        iterations=480_000,
    )
    raw = kdf.derive(password.encode())
    return base64.urlsafe_b64encode(raw)


def encrypt():
    """Read .env, encrypt it, write .env.enc."""
    from cryptography.fernet import Fernet

    if not ENV_FILE.exists():
        print("ERROR: .env file not found. Nothing to encrypt.")
        sys.exit(1)

    key = _derive_key(PASSWORD)
    f = Fernet(key)
    plaintext = ENV_FILE.read_bytes()
    encrypted = f.encrypt(plaintext)
    ENC_FILE.write_bytes(encrypted)
    print(f"Encrypted .env -> .env.enc  ({len(plaintext)} bytes -> {len(encrypted)} bytes)")
    print("You can safely commit .env.enc to version control.")


def decrypt(force=False):
    """Read .env.enc, decrypt it, write .env."""
    from cryptography.fernet import Fernet

    if not ENC_FILE.exists():
        print("ERROR: .env.enc file not found. Run 'python setup_env.py encrypt' first.")
        sys.exit(1)

    if ENV_FILE.exists() and not force:
        print(f"WARNING: {ENV_FILE} already exists. Use --force to overwrite.")
        sys.exit(1)

    key = _derive_key(PASSWORD)
    f = Fernet(key)
    try:
        encrypted = ENC_FILE.read_bytes()
        plaintext = f.decrypt(encrypted)
    except Exception:
        print("ERROR: Decryption failed – wrong password or corrupted file.")
        sys.exit(1)

    ENV_FILE.write_bytes(plaintext)
    print(f"Decrypted .env.enc -> .env  ({len(plaintext)} bytes)")
    print("Local .env is ready. Do NOT commit this file.")


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("encrypt", "decrypt"):
        print(__doc__)
        sys.exit(1)

    action = sys.argv[1]
    force = "--force" in sys.argv

    if action == "encrypt":
        encrypt()
    elif action == "decrypt":
        decrypt(force=force)


if __name__ == "__main__":
    main()
