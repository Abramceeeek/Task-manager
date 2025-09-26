const request = require('supertest');
const express = require('express');
const apiRoutes = require('../server/api');
const db = require('../server/db');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('API Tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM blocks').run();
    db.prepare('DELETE FROM telemetry').run();
  });

  describe('GET /api/tasks', () => {
    it('should return empty array when no tasks', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return tasks when they exist', async () => {
      const task = {
        title: 'Test Task',
        priority: 'high',
        status: 'todo',
        user_id: 1
      };

      await request(app)
        .post('/api/tasks')
        .send(task);

      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Test Task');
    });

    it('should filter by status', async () => {
      await request(app)
        .post('/api/tasks')
        .send({ title: 'Todo Task', status: 'todo', user_id: 1 });

      await request(app)
        .post('/api/tasks')
        .send({ title: 'Done Task', status: 'done', user_id: 1 });

      const res = await request(app).get('/api/tasks?status=todo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Todo Task');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const task = {
        title: 'New Task',
        priority: 'medium',
        status: 'todo',
        user_id: 1
      };

      const res = await request(app)
        .post('/api/tasks')
        .send(task);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Task');
      expect(res.body.id).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({});

      expect(res.status).toBe(500);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('should update task status', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test Task', user_id: 1 });

      const taskId = createRes.body.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test Task', user_id: 1 });

      const taskId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/blocks', () => {
    it('should return empty array when no blocks', async () => {
      const res = await request(app).get('/api/blocks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/telemetry', () => {
    it('should record telemetry data', async () => {
      const telemetry = {
        user_id: 1,
        kind: 'user_edit',
        payload: { action: 'moved_task' }
      };

      const res = await request(app)
        .post('/api/telemetry')
        .send(telemetry);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});