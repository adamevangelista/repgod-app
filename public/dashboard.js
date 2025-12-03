document.addEventListener("DOMContentLoaded", () => {
    const localUserID = localStorage.getItem('liftLogicUserID');
    const localFirstName = localStorage.getItem('liftLogicFirstName');
    const nameDisplay = document.getElementById('user-name-display');
    const logoutBtn = document.getElementById('logout-btn');

    if (nameDisplay) nameDisplay.textContent = localFirstName || "User";
    if (logoutBtn) logoutBtn.addEventListener('click', () => window.logout());

    if (!localUserID) return;

    const settingsBtn = document.getElementById('settings-fab');
    const modal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveWeightBtn = document.getElementById('save-weight-btn');
    const weightInput = document.getElementById('new-weight-input');
    const currentWeightDisplay = document.getElementById('current-weight-display');

    if (settingsBtn && modal) {
        settingsBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            loadWeight();
            loadPresetsManager();
        });
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    if (saveWeightBtn) {
        saveWeightBtn.addEventListener('click', async () => {
            const weight = weightInput.value;
            if (!weight) return;
            try {
                const response = await fetch('/api/weight', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: localUserID, weight: weight })
                });
                if (response.ok) {
                    if (currentWeightDisplay) currentWeightDisplay.textContent = weight;
                    weightInput.value = '';
                    alert("Weight updated!");
                }
            } catch (e) { console.error(e); }
        });
    }

    async function loadWeight() {
        try {
            const response = await fetch(`/api/weight/${localUserID}`);
            if (response.ok) {
                const data = await response.json();
                if (data.length > 0 && currentWeightDisplay) currentWeightDisplay.textContent = data[0].weight;
            }
        } catch (e) { console.error(e); }
    }
    const presetNameInput = document.getElementById('new-preset-name');
    const presetExInput = document.getElementById('new-preset-exercises');
    const createPresetBtn = document.getElementById('create-preset-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const presetListContainer = document.getElementById('existing-presets-list');
    const editIdInput = document.getElementById('edit-preset-id');

    async function loadPresetsManager() {
        if (!presetListContainer) return;
        try {
            const response = await fetch(`/api/presets/${localUserID}`);
            if(response.ok) {
                const presets = await response.json();
                presetListContainer.innerHTML = '';
                if(presets.length === 0) presetListContainer.innerHTML = '<p style="color:#777;">No custom presets.</p>';
                presets.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'preset-item-row';
                    div.innerHTML = `
                        <span><strong>${p.name}</strong></span>
                        <div>
                            <button class="edit-preset-btn" data-id="${p.id}" data-name="${p.name}" data-ex='${JSON.stringify(p.exercises)}'>Edit</button>
                            <button class="delete-preset-btn" data-id="${p.id}">&times;</button>
                        </div>
                    `;
                    presetListContainer.appendChild(div);
                });
                document.querySelectorAll('.delete-preset-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        if(confirm("Delete?")) { await fetch(`/api/presets/${e.target.dataset.id}`, { method: 'DELETE' }); loadPresetsManager(); }
                    });
                });
                document.querySelectorAll('.edit-preset-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        if(presetNameInput) presetNameInput.value = e.target.dataset.name;
                        if(presetExInput) {
                            const exercises = JSON.parse(e.target.dataset.ex);
                            presetExInput.value = exercises.join(', ');
                        }
                        if(editIdInput) editIdInput.value = e.target.dataset.id;
                        if(createPresetBtn) {
                            createPresetBtn.textContent = 'Update Preset';
                            createPresetBtn.classList.remove('btn-secondary');
                            createPresetBtn.classList.add('btn-primary');
                        }
                        if(cancelEditBtn) cancelEditBtn.style.display = 'block';
                    });
                });
            }
        } catch (e) { console.error(e); }
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            if(presetNameInput) presetNameInput.value = '';
            if(presetExInput) presetExInput.value = '';
            if(editIdInput) editIdInput.value = '';
            if(createPresetBtn) {
                createPresetBtn.textContent = 'Create Preset';
                createPresetBtn.classList.remove('btn-primary');
                createPresetBtn.classList.add('btn-secondary');
            }
            cancelEditBtn.style.display = 'none';
        });
    }

    if (createPresetBtn) {
        createPresetBtn.addEventListener('click', async () => {
            const name = presetNameInput.value.trim();
            const exString = presetExInput.value.trim();
            const editId = editIdInput ? editIdInput.value : null;
            if(!name || !exString) return alert("Fill in fields");
            const exList = exString.split(',').map(s => s.trim()).filter(s => s);
            const method = editId ? 'PUT' : 'POST';
            const url = editId ? `/api/presets/${editId}` : '/api/presets';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: localUserID, name: name, exercises: exList })
                });
                if(response.ok) {
                    if (cancelEditBtn) cancelEditBtn.click();
                    loadPresetsManager();
                } else { alert("Error saving preset"); }
            } catch(e) { console.error(e); }
        });
    }

    const monthYearStr = document.getElementById('month-year-str');
    const calendarGrid = document.getElementById('calendar-grid');
    const daysHeader = document.getElementById('calendar-days');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    let currentDate = new Date();
    let workoutDates = new Set();

    if (daysHeader) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysHeader.innerHTML = '';
        dayNames.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day-name';
            dayEl.textContent = day;
            daysHeader.appendChild(dayEl);
        });
    }

    async function fetchWorkoutDates() {
        try {
            const response = await fetch(`/api/workout-dates/${localUserID}`);
            if (!response.ok) throw new Error();
            const dates = await response.json();
            workoutDates = new Set(dates);
        } catch (error) { }
    }

    function renderCalendar() {
        if (!calendarGrid || !monthYearStr) return;
        calendarGrid.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        monthYearStr.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDayOfMonth; i++) calendarGrid.appendChild(document.createElement('div'));
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.textContent = day;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (workoutDates.has(dateStr)) dayCell.classList.add('workout-day');
            calendarGrid.appendChild(dayCell);
        }
    }

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

    async function init() { await fetchWorkoutDates(); renderCalendar(); loadWeight(); }
    init();
});