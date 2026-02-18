from app import create_app, db
from run import seed_data

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        print("Creating tables if they don't exist...")
        db.create_all()
        print("Seeding data...")
        seed_data()
        print("Done!")
