const db = require('../server/db');

const seedData = () => {
  console.log('🌱 Seeding database...');

  try {
    const userId = 1;
    
    db.prepare('INSERT OR IGNORE INTO users (id, email, timezone) VALUES (?, ?, ?)')
      .run(userId, 'demo@motionai.com', 'Europe/London');

    db.prepare(`
      INSERT OR IGNORE INTO preferences (
        user_id, work_hours_by_day, buffer_min, meeting_gap_min, 
        sleep_window, travel_speed_kmh, energy_profile_by_hour, 
        avoid_times, objective, weights
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      JSON.stringify({
        "monday": "09:00-18:00",
        "tuesday": "09:00-18:00", 
        "wednesday": "09:00-18:00",
        "thursday": "09:00-18:00",
        "friday": "09:00-18:00",
        "saturday": "",
        "sunday": ""
      }),
      15,
      10,
      "22:00-07:00",
      5,
      JSON.stringify({
        "09:00": 0.8,
        "10:00": 0.9,
        "11:00": 0.9,
        "12:00": 0.7,
        "13:00": 0.6,
        "14:00": 0.7,
        "15:00": 0.8,
        "16:00": 0.8,
        "17:00": 0.7,
        "18:00": 0.6
      }),
      JSON.stringify([]),
      "Complete all high-priority tasks efficiently",
      JSON.stringify({
        "deep_work_morning": 0.5,
        "context_switching": 0.3,
        "after_hours": 0.2
      })
    );

    const today = new Date();
    const thursday = new Date(today);
    thursday.setDate(today.getDate() + (4 - today.getDay() + 7) % 7);
    const thursdayStr = thursday.toISOString().split('T')[0];

    const tasks = [
      {
        title: "Finish RILA section",
        description: "Complete the RILA documentation section",
        priority: "high",
        status: "todo",
        estimated_minutes: 120,
        deadline_at: `${thursdayStr}T17:00:00Z`,
        energy: "deep",
        user_id: userId
      },
      {
        title: "Call Jamshid",
        description: "Discuss project updates with Jamshid",
        priority: "medium", 
        status: "todo",
        estimated_minutes: 30,
        start_after: `${thursdayStr}T12:00:00Z`,
        due_at: `${thursdayStr}T17:00:00Z`,
        energy: "light",
        user_id: userId
      },
      {
        title: "Review quarterly reports",
        description: "Analyze Q3 performance metrics",
        priority: "high",
        status: "todo", 
        estimated_minutes: 90,
        energy: "deep",
        user_id: userId
      },
      {
        title: "Team standup meeting",
        description: "Daily sync with development team",
        priority: "medium",
        status: "todo",
        estimated_minutes: 15,
        energy: "light",
        user_id: userId
      }
    ];

    tasks.forEach(task => {
      db.prepare(`
        INSERT OR IGNORE INTO tasks (
          title, description, priority, status, estimated_minutes,
          deadline_at, start_after, due_at, energy, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.title,
        task.description,
        task.priority,
        task.status,
        task.estimated_minutes,
        task.deadline_at,
        task.start_after,
        task.due_at,
        task.energy,
        task.user_id
      );
    });

    const fixedEvent = {
      title: "Morning Team Meeting",
      start_dt: `${thursdayStr}T09:00:00Z`,
      end_dt: `${thursdayStr}T10:00:00Z`,
      is_blocking: true,
      is_commute: false,
      user_id: userId
    };

    db.prepare(`
      INSERT OR IGNORE INTO calendar_events (
        title, start_dt, end_dt, is_blocking, is_commute, user_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      fixedEvent.title,
      fixedEvent.start_dt,
      fixedEvent.end_dt,
    fixedEvent.is_blocking ? 1 : 0,
    fixedEvent.is_commute ? 1 : 0,
      fixedEvent.user_id
    );

    console.log('✅ Database seeded successfully!');
    console.log(`📅 Created ${tasks.length} demo tasks`);
    console.log(`📅 Created 1 fixed calendar event for ${thursdayStr}`);
    console.log('🎯 Demo scenario ready - try "Auto Plan" in the UI');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedData();
}

module.exports = seedData;