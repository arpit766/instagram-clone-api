Instagram Clone API - Example CURL Commands
1️⃣ Get Home Feed

Fetch posts from people the user follows:

curl -X GET "http://localhost:3000/api/feed?user_id=13&page=1&limit=10"


user_id=13 → feed for user10

page and limit control pagination

2️⃣ Get Stories

Fetch all active stories visible to a user:

curl -X GET "http://localhost:3000/api/stories?user_id=13"


user_id=13 → stories for user10

Returns stories from followed users

3️⃣ Like / Unlike Post

Toggle like for a post:

curl -X POST "http://localhost:3000/api/posts/3/like" \
-H "Content-Type: application/json" \
-d '{"user_id":13}'


post_id=3 → user30’s video post

user_id=13 → user10 liking/unliking

4️⃣ Comment on a Post

Add a comment to a post:

curl -X POST "http://localhost:3000/api/posts/3/comment" \
-H "Content-Type: application/json" \
-d '{"user_id":13, "text":"Amazing video!"}'


5️⃣ Get Reels

Fetch only posts with media_type = 'reel':

curl -X GET "http://localhost:3000/api/reels?user_id=13&page=1&limit=10"
