document.addEventListener("DOMContentLoaded", () => {
    // 1. SETUP USER INFO
    const localUserID = localStorage.getItem('liftLogicUserID');
    const localFirstName = localStorage.getItem('liftLogicFirstName');
    const nameDisplay = document.getElementById('user-name-display');
    const welcomeMsg = document.getElementById('welcome-message');
    const logoutBtn = document.getElementById('logout-btn');

    if (welcomeMsg) welcomeMsg.textContent = localFirstName || "User";
    if (logoutBtn) logoutBtn.addEventListener('click', () => window.logout());

    if (!localUserID) {
        window.location.href = '/login';
        return;
    }

    const exerciseListContainer = document.getElementById('exercise-list-container');
    const resultsArea = document.getElementById('results-area');
    const chartTitle = document.getElementById('chart-title');
    const tableContainer = document.getElementById('history-table-container');
    const messageArea = document.getElementById('message-area');

    // Add Data Modal Elements
    const addDataBtn = document.getElementById('open-add-data-btn');
    const dataModal = document.getElementById('add-data-modal');
    const closeDataModalBtn = document.getElementById('close-data-modal-btn');
    const saveDataBtn = document.getElementById('save-data-btn');
    const dataDateInput = document.getElementById('add-data-date');
    const dataWeightInput = document.getElementById('add-data-weight');
    const dataRepsInput = document.getElementById('add-data-reps');
    const dataExNameDisplay = document.getElementById('add-data-ex-name');

    let myChart = null;
    let currentExercises = [];
    let currentExerciseId = null;
    let currentExerciseName = "";
    let activeButton = null;

    if (dataDateInput) dataDateInput.valueAsDate = new Date();

    // --- MODAL LOGIC ---
    if (addDataBtn) {
        addDataBtn.addEventListener('click', () => {
            if (!currentExerciseId) return;
            if (dataExNameDisplay) dataExNameDisplay.textContent = currentExerciseName;
            if (dataModal) dataModal.style.display = 'flex';
        });
    }
    if (closeDataModalBtn) closeDataModalBtn.addEventListener('click', () => dataModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === dataModal) dataModal.style.display = 'none'; });

    if (saveDataBtn) {
        saveDataBtn.addEventListener('click', async () => {
            const date = dataDateInput.value;
            const weight = dataWeightInput.value;
            const reps = dataRepsInput.value;

            if(!date || !weight || !reps) return alert("Fill all fields");

            try {
                const response = await fetch('/api/sets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: localUserID,
                        exercise_id: currentExerciseId,
                        date: date,
                        weight: weight,
                        reps: reps
                    })
                });
                if (response.ok) {
                    alert("Set added!");
                    if (dataModal) dataModal.style.display = 'none';
                    loadExerciseHistory(currentExerciseId, currentExerciseName);
                } else {
                    alert("Error adding set");
                }
            } catch(e) { console.error(e); }
        });
    }

    async function loadAllExercises() {
        if (!exerciseListContainer) return;
        try {
            const response = await fetch(`/api/exercises/${localUserID}`);
            if (!response.ok) throw new Error('Could not fetch exercise list.');

            currentExercises = await response.json();
            renderExerciseList();

            if (currentExercises.length > 0) {
                const firstButton = exerciseListContainer.querySelector('.exercise-btn');
                if (firstButton) loadExerciseHistory(currentExercises[0].id, currentExercises[0].name, firstButton);
            }
        } catch (error) {
            console.error(error);
        }
    }

    function renderExerciseList() {
        exerciseListContainer.innerHTML = "";
        if (currentExercises.length === 0) {
             if (resultsArea) resultsArea.style.display = "none";
        }

        currentExercises.forEach(ex => {
            const item = document.createElement('div');
            item.className = 'exercise-item';

            const button = document.createElement('button');
            button.textContent = ex.name;
            button.className = 'btn-secondary exercise-btn';
            button.addEventListener('click', () => loadExerciseHistory(ex.id, ex.name, button));

            const renameBtn = document.createElement('button');
            renameBtn.textContent = 'Rename';
            renameBtn.className = 'btn-tertiary edit-btn';
            renameBtn.addEventListener('click', () => renameExercise(ex.id, ex.name));

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'btn-tertiary delete-btn';
            deleteBtn.addEventListener('click', () => deleteExercise(ex.id, ex.name));

            item.appendChild(button);
            item.appendChild(renameBtn);
            item.appendChild(deleteBtn);
            exerciseListContainer.appendChild(item);
        });
    }

    async function loadExerciseHistory(exerciseID, exerciseName, clickedButton) {
        if (messageArea) messageArea.textContent = "";
        currentExerciseId = exerciseID;
        currentExerciseName = exerciseName;

        try {
            const response = await fetch(`/api/history/${localUserID}/${exerciseID}`);
            if (!response.ok) throw new Error(`Data not found for ${exerciseName}.`);

            const history = await response.json();

            // --- CRITICAL FIX: Show area BEFORE rendering chart ---
            if (resultsArea) resultsArea.style.display = "block";

            if (chartTitle) chartTitle.textContent = `Progress for ${exerciseName}`;

            if (history.length === 0) {
                renderTable(history);
                if (myChart) myChart.destroy();
            } else {
                const graphData = processDataForGraph(history);
                renderChart(graphData);
                renderTable(history);
            }

            if (activeButton) activeButton.classList.remove('active');
            if (clickedButton) {
                clickedButton.classList.add('active');
                activeButton = clickedButton;
            } else {
                const btns = document.querySelectorAll('.exercise-btn');
                btns.forEach(b => {
                    if (b.textContent === exerciseName) {
                        b.classList.add('active');
                        activeButton = b;
                    }
                });
            }

        } catch (error) {
            console.error(error);
            if (messageArea) messageArea.textContent = `Error: ${error.message}`;
        }
    }

    // ... (renameExercise and deleteExercise functions remain same) ...
    async function renameExercise(exerciseID, oldName) {
        const newName = prompt(`Enter new name for "${oldName}":`, oldName);
        if (!newName || newName === oldName) return;

        try {
            const response = await fetch(`/api/exercise/${localUserID}/${exerciseID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            if (response.status === 409) {
                const data = await response.json();
                if (data.error === "Merge needed") {
                    if (confirm(`"${newName}" already exists. Do you want to merge these exercises?`)) {
                        await fetch(`/api/exercise/${localUserID}/${exerciseID}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: newName, force_merge: true })
                        });
                        alert("Merged successfully!");
                        loadAllExercises();
                        if (resultsArea) resultsArea.style.display = "none";
                        return;
                    }
                }
            }

            if (!response.ok && response.status !== 409) throw new Error("Error renaming");

            if (response.ok) {
                loadAllExercises();
                if (resultsArea) resultsArea.style.display = "none";
            }
        } catch(error) {
            alert(`Error: ${error.message}`);
        }
    }

    async function deleteExercise(exerciseID, name) {
        if (!confirm(`Are you sure you want to delete "${name}"?\nAll logged sets for this exercise will be permanently lost.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/exercise/${localUserID}/${exerciseID}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            loadAllExercises();
            if (resultsArea) resultsArea.style.display = "none";
        } catch(error) {
            alert(`Error: ${error.message}`);
        }
    }

    function calculateOneRepMax(weight, reps) {
        if (reps === 1) return weight;
        return weight * (1 + (reps / 30));
    }

    function processDataForGraph(history) {
        const dailyMaxes = {};

        for (const set of history) {
            const date = set.workout_date;
            const weight = set.weight;
            const reps = set.reps;

            const e1rm = calculateOneRepMax(weight, reps);

            if (!dailyMaxes[date]) {
                dailyMaxes[date] = e1rm;
            } else {
                dailyMaxes[date] = Math.max(dailyMaxes[date], e1rm);
            }
        }

        const sortedDates = Object.keys(dailyMaxes).sort();
        const sortedData = sortedDates.map(date => dailyMaxes[date]);
        return { labels: sortedDates, data: sortedData };
    }

    function renderChart(graphData) {
        // Safety check for Chart.js
        if (typeof Chart === 'undefined') {
            console.error("Chart.js library not loaded.");
            return;
        }

        const canvas = document.getElementById('progress-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (myChart) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: graphData.labels,
                datasets: [{
                    label: 'Est. 1-Rep Max (Strength Score)',
                    data: graphData.data,
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    borderColor: 'rgba(0, 122, 255, 1)',
                    borderWidth: 2,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: 'Est. Max Strength (lbs)'}
                    },
                    x: {
                        title: { display: true, text: 'Date' }
                    }
                }
            }
        });
    }

    function computePRFlags(history) {
        // history is chronologically ascending; flag any set whose est. 1RM
        // exceeds every set before it as a new personal record.
        let runningMax = -Infinity;
        return history.map(set => {
            const e1rm = calculateOneRepMax(set.weight, set.reps);
            const isPR = e1rm > runningMax;
            if (isPR) runningMax = e1rm;
            return isPR;
        });
    }

    function renderTable(history) {
        const prFlags = computePRFlags(history);
        let tableHtml = `<table><thead><tr><th>Date</th><th>Set</th><th>Weight</th><th>Reps</th><th>Est. 1RM</th></tr></thead><tbody>`;
        if (history.length > 0) {
            for (let i = history.length - 1; i >= 0; i--) {
                const set = history[i];
                const e1rm = calculateOneRepMax(set.weight, set.reps).toFixed(1);
                const isPR = prFlags[i];
                const rowClass = isPR ? ' class="pr-row"' : '';
                const badge = isPR ? ' <span class="pr-badge">PR</span>' : '';
                tableHtml += `<tr${rowClass}><td>${set.workout_date}</td><td>${set.set_number}</td><td>${set.weight} lbs</td><td>${set.reps}</td><td>${e1rm}${badge}</td></tr>`;
            }
        } else {
             tableHtml += `<tr><td colspan="5" style="text-align:center;">No sets found.</td></tr>`;
        }
        tableHtml += `</tbody></table>`;
        tableContainer.innerHTML = tableHtml;
    }

    loadAllExercises();
});