from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config

db = SQLAlchemy()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    from flask_smorest import Api
    api = Api(app)

    db.init_app(app)
    CORS(app)

    from app.routes import main
    app.register_blueprint(main)
    
    from app.api_history import blp as history_blp
    api.register_blueprint(history_blp)

    return app
