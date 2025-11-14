document.getElementById('welcome-message').textContent = userName;
document.getElementById('logout-btn').addEventListener('click', logout);

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById('workout-date').valueAsDate = new Date();

    const form = document.getElementById('workout-form');
    const addExerciseBtn = document.getElementById('add-exercise-btn');
    const exercisesContainer = document.getElementById('exercises-container');

    let exerciseCount = 0;

    addExerciseBtn.addEventListener('click', () => {
        exerciseCount++;

        const exerciseBlock = document.createElement('div');
        exerciseBlock.className = 'exercise-block';
        exerciseBlock.dataset.exerciseId = exerciseCount;

        exerciseBlock.innerHTML = `
            <div class="form-group">
                <label for="ex-name-${exerciseCount}">Exercise Name</label>
                <input type="text" id="ex-name-${exerciseCount}" class="ex-name" placeholder="e.g., Lat Pulldown" required>
            </div>
            <div class="sets-container"></div>
            <button type="button" class="btn-tertiary add-set-btn">+ Add Set</button>
        `;

        exercisesContainer.appendChild(exerciseBlock);
        exerciseBlock.querySelector('.add-set-btn').addEventListener('click', () => addSet(exerciseBlock));
        addSet(exerciseBlock);
    });

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
            user_id: parseInt(userID),
            title: document.getElementById('workout-title').value,
            date: document.getElementById('workout-date').value,
            sets: allSetsData
        };

        try {
            const response = await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(workoutData),
            });
            const result = await response.json();
            if (response.ok) {
                form.reset();
                exercisesContainer.innerHTML = '';
                document.getElementById('workout-date').valueAsDate = new Date();
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            alert(`Error: ${error.message}.`);
        }
    });
});