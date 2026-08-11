document.addEventListener("DOMContentLoaded", () => {
    const localUserID = localStorage.getItem('liftLogicUserID');
    const localFirstName = localStorage.getItem('liftLogicFirstName');

    if (!localUserID) {
        window.location.href = '/login';
        return;
    }

    const welcomeMsg = document.getElementById('welcome-message');
    const logoutBtn = document.getElementById('logout-btn');
    if (welcomeMsg) welcomeMsg.textContent = localFirstName || "User";
    if (logoutBtn) logoutBtn.addEventListener('click', () => window.logout());

    const dateInput = document.getElementById('workout-date');
    const form = document.getElementById('workout-form');
    const addExerciseBtn = document.getElementById('add-exercise-btn');
    const exercisesContainer = document.getElementById('exercises-container');
    const datalist = document.getElementById('exercise-list-data');
    const titleInput = document.getElementById('workout-title');
    const presetSelector = document.getElementById('preset-selector');
    const timerDisplay = document.getElementById('timer-display');

    const settingsBtn = document.getElementById('settings-fab');
    const modal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const createPresetBtn = document.getElementById('create-preset-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const presetListContainer = document.getElementById('existing-presets-list');
    const presetNameInput = document.getElementById('new-preset-name');
    const presetExInput = document.getElementById('new-preset-exercises');
    const editIdInput = document.getElementById('edit-preset-id');

    let countdownInterval;
    let exerciseCount = 0;
    let lastUsedDuration = 90;

    if (dateInput) dateInput.valueAsDate = new Date();

    async function loadPresetsDropdown() {
        if (!presetSelector) return;
        try {
            const response = await fetch(`/api/presets/${localUserID}`);
            if(response.ok) {
                const presets = await response.json();
                presetSelector.innerHTML = '<option value="">-- Select a Preset --</option>';
                presets.forEach(p => {
                    const option = document.createElement('option');
                    option.value = JSON.stringify(p);
                    option.textContent = p.name;
                    presetSelector.appendChild(option);
                });
            }
        } catch (e) { console.error("Error loading presets:", e); }
    }

    if (presetSelector) {
        presetSelector.addEventListener('change', (e) => {
            if (!e.target.value) return;
            try {
                const preset = JSON.parse(e.target.value);
                if (exercisesContainer) exercisesContainer.innerHTML = '';
                if (preset.exercises) {
                    preset.exercises.forEach(name => { addExerciseBlock(name); });
                }
                if (titleInput) {
                    titleInput.value = `${preset.name} ${getFormattedDate()}`;
                }
            } catch (err) { console.error("Error parsing preset", err); }
        });
    }
    if (settingsBtn && modal) {
        settingsBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            loadPresetsManager();
        });
        if(closeModalBtn) closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            resetPresetForm();
        });
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resetPresetForm();
            }
        });
    }

    function resetPresetForm() {
        if (!presetNameInput) return;
        presetNameInput.value = '';
        presetExInput.value = '';
        if(editIdInput) editIdInput.value = '';
        if(createPresetBtn) {
            createPresetBtn.textContent = 'Create Preset';
            createPresetBtn.classList.remove('btn-primary');
            createPresetBtn.classList.add('btn-secondary');
        }
        if(cancelEditBtn) cancelEditBtn.style.display = 'none';
    }

    async function loadPresetsManager() {
        if (!presetListContainer) return;
        try {
            const response = await fetch(`/api/presets/${localUserID}`);
            if(response.ok) {
                const presets = await response.json();
                presetListContainer.innerHTML = '';
                if(presets.length === 0) {
                    presetListContainer.innerHTML = '<p style="color:#777; font-size:0.9em;">No custom presets.</p>';
                }
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
                        if(confirm("Delete?")) {
                            await fetch(`/api/presets/${e.target.dataset.id}`, { method: 'DELETE' });
                            loadPresetsManager();
                            loadPresetsDropdown();
                        }
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

    if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetPresetForm);

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
                    resetPresetForm();
                    loadPresetsManager();
                    loadPresetsDropdown();
                } else { alert("Error saving preset"); }
            } catch(e) { console.error(e); }
        });
    }

    async function loadUserExercises() {
        if (!datalist) return;
        try {
            const response = await fetch(`/api/exercises/${localUserID}`);
            if (!response.ok) return;
            const exercises = await response.json();
            datalist.innerHTML = '';
            exercises.forEach(ex => {
                const option = document.createElement('option');
                option.value = ex.name;
                datalist.appendChild(option);
            });
        } catch (error) { console.error("Error loading exercises:", error); }
    }

    function addExerciseBlock(presetName = "") {
        if (!exercisesContainer) return;
        exerciseCount++;
        const exerciseBlock = document.createElement('div');
        exerciseBlock.className = 'exercise-block';
        exerciseBlock.dataset.exerciseId = exerciseCount;
        exerciseBlock.innerHTML = `
            <div class="exercise-header">
                <div class="form-group">
                    <label>Exercise Name</label>
                    <input type="text" class="ex-name" value="${presetName}" list="exercise-list-data" placeholder="e.g., Lat Pulldown" required>
                </div>
                <button type="button" class="btn-tertiary delete-ex-btn">Delete</button>
            </div>
            <div class="last-performance"></div>
            <div class="sets-container"></div>
            <button type="button" class="btn-tertiary add-set-btn">+ Add Set</button>
        `;
        exercisesContainer.appendChild(exerciseBlock);

        const exerciseInput = exerciseBlock.querySelector('.ex-name');
        const performanceDiv = exerciseBlock.querySelector('.last-performance');

        exerciseInput.addEventListener('blur', () => {
            if(exerciseInput.value) fetchLastPerformance(exerciseInput.value, performanceDiv);
        });
        if (presetName) fetchLastPerformance(presetName, performanceDiv);

        exerciseBlock.querySelector('.add-set-btn').addEventListener('click', () => {
            addSet(exerciseBlock);
            startTimer(lastUsedDuration);
        });
        exerciseBlock.querySelector('.delete-ex-btn').addEventListener('click', () => exerciseBlock.remove());
        addSet(exerciseBlock);
    }

    function addSet(exerciseBlock) {
        const setsContainer = exerciseBlock.querySelector('.sets-container');
        const setCount = setsContainer.children.length + 1;
        const setGroup = document.createElement('div');
        setGroup.className = 'set-group';
        setGroup.innerHTML = `
            <label>Set ${setCount}</label>
            <input type="number" step="any" class="set-weight" placeholder="Weight" required>
            <input type="number" class="set-reps" placeholder="Reps" required>
        `;
        setsContainer.appendChild(setGroup);
    }

    async function fetchLastPerformance(exerciseName, performanceDiv) {
        performanceDiv.textContent = 'Loading last performance...';
        try {
            const response = await fetch(`/api/last-performance/${localUserID}/${encodeURIComponent(exerciseName)}`);
            if (!response.ok) {
                performanceDiv.textContent = 'No previous data found.';
                performanceDiv.classList.add('last-performance-empty');
                return;
            }
            const data = await response.json();
            let perfString = `Last (${data.date}): `;
            perfString += data.sets.map(s => `${s.weight}x${s.reps}`).join(', ');
            performanceDiv.textContent = perfString;
            performanceDiv.classList.remove('last-performance-empty');
        } catch (error) {
            performanceDiv.textContent = 'Could not load data.';
            performanceDiv.classList.add('last-performance-empty');
        }
    }

    if (addExerciseBtn) addExerciseBtn.addEventListener('click', () => addExerciseBlock());

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const allSetsData = [];
            const exerciseBlocks = document.querySelectorAll('.exercise-block');
            for (const block of exerciseBlocks) {
                const exerciseName = block.querySelector('.ex-name').value;
                const setGroups = block.querySelectorAll('.set-group');
                let setNumber = 1;
                for (const set of setGroups) {
                    allSetsData.push({
                        name: exerciseName,
                        set: setNumber,
                        weight: parseFloat(set.querySelector('.set-weight').value),
                        reps: parseInt(set.querySelector('.set-reps').value)
                    });
                    setNumber++;
                }
            }
            const workoutData = {
                user_id: parseInt(localUserID),
                title: titleInput ? titleInput.value : "Workout",
                date: dateInput ? dateInput.value : getFormattedDate(),
                sets: allSetsData
            };
            try {
                const response = await fetch('/api/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify(workoutData),
                });
                if (response.ok) {
                    form.reset();
                    if(exercisesContainer) exercisesContainer.innerHTML = '';
                    if (dateInput) dateInput.valueAsDate = new Date();
                    loadUserExercises();
                    alert("Workout Saved!");
                } else { throw new Error('Unknown error'); }
            } catch (error) { alert(`Error saving workout`); }
        });
    }

    function startTimer(duration) {
        if (!timerDisplay) return;

        if (countdownInterval) clearInterval(countdownInterval);

        let timer = duration;
        timerDisplay.classList.remove('timer-display-hide');
        timerDisplay.classList.add('timer-display-show');

        updateTimerText(timer);

        countdownInterval = setInterval(() => {
            timer--;
            updateTimerText(timer);
            if (timer < 0) {
                stopTimer();
                timerDisplay.textContent = "Done!";
                timerDisplay.classList.add('timer-display-done');
                setTimeout(() => {
                    timerDisplay.classList.remove('timer-display-show');
                    timerDisplay.classList.remove('timer-display-done');
                    timerDisplay.classList.add('timer-display-hide');
                }, 3000);
            }
        }, 1000);
    }

    function updateTimerText(timer) {
        let minutes = Math.floor(timer / 60);
        let seconds = timer % 60;
        timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    function stopTimer() {
        if (countdownInterval) clearInterval(countdownInterval);
        if (timerDisplay) {
            timerDisplay.classList.remove('timer-display-show');
            timerDisplay.classList.add('timer-display-hide');
        }
    }

    document.querySelectorAll('.timer-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            lastUsedDuration = parseInt(button.dataset.time);
            startTimer(lastUsedDuration);
        });
    });

    if (timerDisplay) timerDisplay.addEventListener('click', stopTimer);

    function getFormattedDate() {
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const yyyy = today.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    }

    loadUserExercises();
    loadPresetsDropdown();
});