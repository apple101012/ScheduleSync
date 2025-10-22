
// Users
const users = [
  {
    username: "alice",
    email: "alice@example.com",
    password_hash: "$2b$12$w1Q8Qw1Q8Qw1Q8Qw1Q8QwOQw1Q8Qw1Q8Qw1Q8Qw1Q8Qw1Q8Qw1Q8Qw", // bcrypt hash for 'password123'
    friends: ["bob", "carol"]
  },
  {
    username: "bob",
    email: "bob@example.com",
    password_hash: "$2b$12$w1Q8Qw1Q8Qw1Q8Qw1Q8QwOQw1Q8Qw1Q8Qw1Q8Qw1Q8Qw1Q8Qw1Q8Qw", // bcrypt hash for 'password123'
    friends: ["alice"]
  },
  {
    username: "carol",
    email: "carol@example.com",
    password_hash: "$2b$12$w1Q8Qw1Q8Qw1Q8Qw1Q8QwOQw1Q8Qw1Q8Qw1Q8Qw1Q8Qw1Q8Qw1Q8Qw", // bcrypt hash for 'password123'
    friends: ["alice"]
  }
];

db.users.deleteMany({});
db.users.insertMany(users);

// Schedules
const schedules = [
  {
    username: "alice",
    events: [
      { day: "monday", start_time: "09:00", end_time: "11:00", status: "class" },
      { day: "friday", start_time: "15:00", end_time: "17:00", status: "work" },
      { day: "friday", start_time: "17:00", end_time: "23:00", status: "free" }
    ]
  },
  {
    username: "bob",
    events: [
      { day: "friday", start_time: "14:00", end_time: "16:00", status: "class" },
      { day: "friday", start_time: "16:00", end_time: "23:00", status: "free" }
    ]
  },
  {
    username: "carol",
    events: [
      { day: "friday", start_time: "15:00", end_time: "18:00", status: "work" },
      { day: "friday", start_time: "18:00", end_time: "23:00", status: "free" }
    ]
  }
];

db.schedules.deleteMany({});
db.schedules.insertMany(schedules);

print('Sample data inserted!');
