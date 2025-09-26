class MotionAI {
    constructor() {
        this.tasks = [];
        this.blocks = [];
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.currentView = 'tasks';
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
        }
        this.setupEventListeners();
        this.loadTasks();
        this.updateDate();
        this.initNavigation();
        this.initFilters();
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Task management
        document.getElementById('task-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        document.querySelector('.btn-secondary-outline').addEventListener('click', () => this.addTask());
        document.getElementById('ai-parse-btn').addEventListener('click', () => this.parseWithAI());
        document.getElementById('plan-btn').addEventListener('click', () => this.planDay());
        document.getElementById('coach-btn').addEventListener('click', () => this.getCoaching());

        // Modal handlers
        document.getElementById('close-plan-modal').addEventListener('click', () => {
            document.getElementById('plan-modal').classList.add('hidden');
        });

        document.getElementById('approve-btn').addEventListener('click', () => this.approvePlan());
        document.getElementById('reject-btn').addEventListener('click', () => this.rejectPlan());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'n':
                        e.preventDefault();
                        document.getElementById('task-input').focus();
                        break;
                    case 'p':
                        e.preventDefault();
                        this.planDay();
                        break;
                }
            }
        });
    }

    initNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                this.currentView = item.dataset.view;
                this.updateView();
            });
        });
    }

    initFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(f => f.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.renderTasks();
            });
        });

        const viewToggles = document.querySelectorAll('.view-toggle');
        viewToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                viewToggles.forEach(v => v.classList.remove('active'));
                toggle.classList.add('active');
                // TODO: Implement board view
            });
        });
    }

    updateView() {
        // For now, all views show tasks. In a full app, you'd switch content here
        console.log('Switched to view:', this.currentView);
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        document.documentElement.classList.toggle('dark');
    }

    updateDate() {
        const now = new Date();
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    }

    async loadTasks() {
        try {
            const response = await fetch('/api/tasks');
            this.tasks = await response.json();
            this.renderTasks();
            this.renderSchedule();
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.showToast('Failed to load tasks', 'error');
        }
    }

    renderTasks() {
        const container = document.getElementById('tasks-container');

        let filteredTasks = this.tasks;
        if (this.currentFilter !== 'all') {
            filteredTasks = this.tasks.filter(task => task.status === this.currentFilter);
        }

        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ri-task-line empty-state-icon"></i>
                    <div class="empty-state-title">${this.currentFilter === 'all' ? 'No tasks yet' : `No ${this.currentFilter.replace('_', ' ')} tasks`}</div>
                    <div class="empty-state-description">
                        ${this.currentFilter === 'all'
                            ? 'Add your first task to get started'
                            : `Create a task and set it to ${this.currentFilter.replace('_', ' ')}`
                        }
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredTasks.map((task, index) => this.createTaskCard(task, index)).join('');
    }

    createTaskCard(task, index) {
        const completedClass = task.status === 'done' ? 'completed' : '';

        return `
            <div class="task-card ${completedClass} animate-fade-in" style="animation-delay: ${index * 50}ms" data-task-id="${task.id}">
                <div class="task-actions">
                    <button class="task-action" onclick="motionAI.editTask(${task.id})" title="Edit task">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="task-action" onclick="motionAI.deleteTask(${task.id})" title="Delete task">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>

                <div class="task-title">${this.escapeHtml(task.title)}</div>

                ${task.description ? `<div class="text-sm text-gray-600 dark:text-gray-400 mb-2">${this.escapeHtml(task.description)}</div>` : ''}

                <div class="task-meta">
                    <span class="priority-badge ${task.priority}">${this.capitalize(task.priority)}</span>
                    <span class="status-badge ${task.status}">${this.formatStatus(task.status)}</span>
                    ${task.estimated_duration ? `
                        <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <i class="ri-time-line mr-1"></i>
                            ${task.estimated_duration}m
                        </span>
                    ` : ''}
                    ${task.due_date ? `
                        <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <i class="ri-calendar-line mr-1"></i>
                            ${this.formatDate(task.due_date)}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderSchedule() {
        const container = document.getElementById('schedule-timeline');

        if (this.blocks.length === 0) {
            container.innerHTML = `
                <div class="empty-state py-8">
                    <i class="ri-calendar-line empty-state-icon"></i>
                    <div class="empty-state-title">No schedule yet</div>
                    <div class="empty-state-description">Use Auto Plan to create your schedule</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.blocks.map(block => `
            <div class="schedule-item">
                <div class="schedule-time">${this.formatTime(block.start_time)}</div>
                <div class="schedule-title">${this.escapeHtml(block.task_title || block.title)}</div>
            </div>
        `).join('');
    }

    async addTask() {
        const input = document.getElementById('task-input');
        const title = input.value.trim();
        if (!title) return;

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    status: 'todo',
                    priority: 'medium',
                    user_id: 1
                })
            });

            if (response.ok) {
                input.value = '';
                await this.loadTasks();
                this.showToast('Task added successfully', 'success');
            } else {
                throw new Error('Failed to add task');
            }
        } catch (error) {
            console.error('Error adding task:', error);
            this.showToast('Failed to add task', 'error');
        }
    }

    async parseWithAI() {
        const input = document.getElementById('task-input');
        const text = input.value.trim();
        if (!text) return;

        this.showLoading(true);

        try {
            const response = await fetch('/api/ai/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                input.value = '';
                await this.loadTasks();
                this.showToast('Task parsed and added with AI', 'success');
            } else {
                throw new Error(result.error || 'AI parsing failed');
            }
        } catch (error) {
            console.error('AI parsing error:', error);
            this.showToast('AI parsing failed. Task added as simple task.', 'error');
            // Fallback to regular task creation
            await this.addTask();
        } finally {
            this.showLoading(false);
        }
    }

    async planDay() {
        this.showLoading(true);

        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch('/api/schedule/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: 1,
                    date: today,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showPlanPreview(result.plan);
                this.showToast('Day planned successfully', 'success');
            } else {
                throw new Error(result.error || 'Planning failed');
            }
        } catch (error) {
            console.error('Planning error:', error);
            this.showToast('Planning failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showPlanPreview(plan) {
        const modal = document.getElementById('plan-modal');
        const preview = document.getElementById('plan-preview');

        preview.innerHTML = plan.blocks.map(block => `
            <div class="schedule-item">
                <div class="schedule-time">${this.formatTime(block.start_time)}</div>
                <div class="schedule-title">${this.escapeHtml(block.task_title)}</div>
            </div>
        `).join('');

        modal.classList.remove('hidden');
    }

    async approvePlan() {
        try {
            const response = await fetch('/api/schedule/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 1 })
            });

            if (response.ok) {
                await this.loadTasks();
                document.getElementById('plan-modal').classList.add('hidden');
                this.showToast('Schedule applied successfully', 'success');
            } else {
                throw new Error('Failed to apply schedule');
            }
        } catch (error) {
            console.error('Apply schedule error:', error);
            this.showToast('Failed to apply schedule', 'error');
        }
    }

    rejectPlan() {
        document.getElementById('plan-modal').classList.add('hidden');
        this.showToast('Plan rejected', 'info');
    }

    async getCoaching() {
        const goals = document.getElementById('goals-input').value.trim();
        if (!goals) {
            this.showToast('Please enter your goals first', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/ai/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goals, tasks: this.tasks })
            });

            const result = await response.json();

            if (response.ok && result.advice) {
                const responseDiv = document.getElementById('coach-response');
                responseDiv.querySelector('p').textContent = result.advice;
                responseDiv.classList.remove('hidden');
                this.showToast('AI advice received', 'success');
            } else {
                throw new Error(result.error || 'Coaching failed');
            }
        } catch (error) {
            console.error('Coaching error:', error);
            this.showToast('Failed to get AI advice', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Task Management Methods
    editTask(taskId) {
        console.log('Edit task:', taskId);
        // TODO: Implement edit modal
        this.showToast('Edit functionality coming soon', 'info');
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadTasks();
                this.showToast('Task deleted successfully', 'success');
            } else {
                throw new Error('Failed to delete task');
            }
        } catch (error) {
            console.error('Delete task error:', error);
            this.showToast('Failed to delete task', 'error');
        }
    }

    // Utility Methods
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');

        const icons = {
            success: 'ri-check-circle-line',
            error: 'ri-error-warning-line',
            info: 'ri-information-line'
        };

        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="${icons[type]}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        // Remove toast after delay
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Helper Methods
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    formatStatus(status) {
        return status.replace('_', ' ').split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    formatTime(timeString) {
        const time = new Date(`2000-01-01T${timeString}`);
        return time.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Initialize the app
const motionAI = new MotionAI();