document.getElementById('welcome-message').textContent = userName;
document.getElementById('logout-btn').addEventListener('click', logout);

document.addEventListener("DOMContentLoaded", () => {
    const exerciseListContainer = document.getElementById('exercise-list-container');
    const resultsArea = document.getElementById('results-area');
    const chartTitle = document.getElementById('chart-title');
    const tableContainer = document.getElementById('history-table-container');

    let myChart = null;
    let currentExercises = [];
    let activeButton = null;

    async function loadAllExercises() {
        try {
            const response = await fetch(`/api/exercises/${userID}`);
            if (!response.ok) throw new Error('Could not fetch exercise list.');

            currentExercises = await response.json();
            renderExerciseList();

            if (currentExercises.length > 0) {
                const firstButton = exerciseListContainer.querySelector('.exercise-btn');
                loadExerciseHistory(currentExercises[0].id, currentExercises[0].name, firstButton);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    function renderExerciseList() {
        exerciseListContainer.innerHTML = "";
        if (currentExercises.length === 0) {
             resultsArea.style.display = "none";
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
        try {
            const response = await fetch(`/api/history/${userID}/${exerciseID}`);
            if (!response.ok) throw new Error(`Data not found for ${exerciseName}.`);

            const history = await response.json();
            chartTitle.textContent = `Progress for ${exerciseName}`;

            if (history.length === 0) {
                renderTable(history);
                if (myChart) myChart.destroy();
            } else {
                const graphData = processDataForGraph(history);
                renderChart(graphData);
                renderTable(history);
            }

            resultsArea.style.display = "block";

            if (activeButton) activeButton.classList.remove('active');
            clickedButton.classList.add('active');
            activeButton = clickedButton;

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async function renameExercise(exerciseID, oldName) {
        const newName = prompt(`Enter new name for "${oldName}":`, oldName);
        if (!newName || newName === oldName) return;

        try {
            const response = await fetch(`/api/exercise/${userID}/${exerciseID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            loadAllExercises();
            resultsArea.style.display = "none";
        } catch(error) {
            alert(`Error: ${error.message}`);
        }
    }

    async function deleteExercise(exerciseID, name) {
        if (!confirm(`Are you sure you want to delete "${name}"?\nAll logged sets for this exercise will be permanently lost.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/exercise/${userID}/${exerciseID}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            loadAllExercises();
            resultsArea.style.display = "none";
        } catch(error) {
            alert(`Error: ${error.message}`);
        }
    }

    function processDataForGraph(history) {
        const dailyMaxes = {};
        for (const set of history) {
            const date = set.workout_date;
            const weight = set.weight;
            if (!dailyMaxes[date]) dailyMaxes[date] = weight;
            else dailyMaxes[date] = Math.max(dailyMaxes[date], weight);
        }
        const sortedDates = Object.keys(dailyMaxes).sort();
        const sortedData = sortedDates.map(date => dailyMaxes[date]);
        return { labels: sortedDates, data: sortedData };
    }
    function renderChart(graphData) {
        const ctx = document.getElementById('progress-chart').getContext('2d');
        if (myChart) myChart.destroy();
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: graphData.labels,
                datasets: [{
                    label: 'Max Weight Lifted (lbs)',
                    data: graphData.data,
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    borderColor: 'rgba(0, 122, 255, 1)',
                    borderWidth: 2,
                    tension: 0.1
                }]
            },
            options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Weight (lbs)'}}, x: { title: { display: true, text: 'Date'}}}}
        });
    }
    function renderTable(history) {
        let tableHtml = `<table><thead><tr><th>Date</th><th>Set</th><th>Weight</th><th>Reps</th></tr></thead><tbody>`;
        if (history.length > 0) {
            for (const set of history) {
                tableHtml += `<tr><td>${set.workout_date}</td><td>${set.set_number}</td><td>${set.weight} lbs</td><td>${set.reps}</td></tr>`;
            }
        } else {
             tableHtml += `<tr><td colspan="4" style="text-align:center;">No sets found.</td></tr>`;
        }
        tableHtml += `</tbody></table>`;
        tableContainer.innerHTML = tableHtml;
    }

    loadAllExercises();
});