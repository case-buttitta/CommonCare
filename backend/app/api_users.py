from flask_smorest import Blueprint, abort
from flask.views import MethodView
from app.models import User
from app.auth import token_required
from app.schemas import UserSchema, UserQueryArgsSchema

blp = Blueprint(
    'Users API', 'users_api', url_prefix='/api',
    description='Operations on Users'
)

@blp.route('/users')
class UserList(MethodView):
    @blp.arguments(UserQueryArgsSchema, location='query')
    @blp.response(200, UserSchema(many=True))
    @token_required
    def get(current_user, self, query_args):
        """List users explicitly filtered by location."""
        location_id = query_args.get('location_id')
        user_type = query_args.get('user_type')

        # Access control: Prevent crossing location boundaries
        if current_user.user_type != 'location_admin' and current_user.location_id and current_user.location_id != location_id:
            abort(403, message='Access denied to this location')

        query = User.query.filter_by(location_id=location_id)
        if user_type:
            query = query.filter_by(user_type=user_type)

        return query.all()
