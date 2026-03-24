from flask import Flask, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config

db = SQLAlchemy()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)

    ALLOWED_ORIGINS = [
        "https://case-buttitta.github.io",
        "http://localhost:5173",
        "http://localhost:5001",
    ]

    CORS(app, origins=ALLOWED_ORIGINS,
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    from flask_smorest import Api
    api = Api(app)

    from app.routes import main
    app.register_blueprint(main)

    from app.messaging_routes import messaging
    app.register_blueprint(messaging)
    
    from app.api_history import blp as history_blp
    api.register_blueprint(history_blp)

    with app.app_context():
        db.create_all()

    return app
