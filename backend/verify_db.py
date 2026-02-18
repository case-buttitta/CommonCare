from app import create_app, db
from app.models import User

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        try:
            user_count = User.query.count()
            print(f"User count in DB: {user_count}")
            if user_count > 0:
                print("✓ Database is seeded.")
            else:
                print("! Database is empty.")
        except Exception as e:
            print(f"Error connecting to DB: {e}")
