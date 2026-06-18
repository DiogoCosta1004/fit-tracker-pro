import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ================== NAVEGAÇÃO SPA ==================
const navLinks = document.querySelectorAll('#main-nav a');
const views = document.querySelectorAll('.view-section');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        
        link.classList.add('active');
        const targetId = link.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        const subtitle = document.getElementById('header-subtitle');
        if(targetId === 'view-dashboard') subtitle.textContent = "Acompanhe seu progresso diário.";
        if(targetId === 'view-history') subtitle.textContent = "Seu banco de dados de evolução.";
        if(targetId === 'view-goals') subtitle.textContent = "Defina onde você quer chegar.";
        if(targetId === 'view-training') subtitle.textContent = "Gerencie seus blocos de treino e progressões.";
    });
});

// ================== VARIÁVEIS GLOBAIS ==================
const weightForm = document.getElementById('weight-form');
const editIdInput = document.getElementById('edit-id');
const submitBtn = document.getElementById('submit-weight-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const formTitle = document.getElementById('form-title');

let globalWeights = []; 
let userGoalWeight = null; 

// ================== AUTENTICAÇÃO E INICIALIZAÇÃO ==================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loadUserProfile(user.uid);
        loadWeights(user.uid);
        initTrainingDays(); 
    }
});

async function loadUserProfile(uid) {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        document.getElementById('user-greeting').textContent = `Olá, ${userData.firstName || 'Atleta'}`;
        
        if (userData.goalWeight) {
            userGoalWeight = userData.goalWeight;
            document.getElementById('goal-weight-dash').textContent = `${userGoalWeight} kg`;
            document.getElementById('goal-input').value = userGoalWeight;
        }
    }
}

// ================== LÓGICA DE METAS E PESAGENS ==================
document.getElementById('save-goal-btn')?.addEventListener('click', async () => {
    const newGoal = document.getElementById('goal-input').value;
    if (newGoal && !isNaN(newGoal)) {
        const goalValue = parseFloat(newGoal);
        const btn = document.getElementById('save-goal-btn');
        btn.textContent = "Salvando...";
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid), { goalWeight: goalValue }, { merge: true });
            userGoalWeight = goalValue;
            document.getElementById('goal-weight-dash').textContent = `${goalValue} kg`;
            showToast("Meta atualizada!");
            if (globalWeights.length > 0) updateDashboardCards(globalWeights);
        } catch (error) {
            alert("Erro ao salvar a meta.");
        } finally {
            btn.textContent = "Atualizar Meta";
        }
    }
});

if (weightForm) {
    weightForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('weight-date').value;
        const weight = parseFloat(document.getElementById('weight-value').value);
        const notes = document.getElementById('weight-notes').value;
        const editId = editIdInput.value;
        
        if (!auth.currentUser) return;
        submitBtn.disabled = true;

        try {
            if (editId) {
                await updateDoc(doc(db, `users/${auth.currentUser.uid}/pesagens`, editId), { date, weight, notes });
                showToast("Registro atualizado!");
                resetForm();
            } else {
                await addDoc(collection(db, `users/${auth.currentUser.uid}/pesagens`), { date, weight, notes, timestamp: serverTimestamp() });
                showToast("Evolução registrada. 💪");
                weightForm.reset();
                document.getElementById('weight-date').valueAsDate = new Date();
            }
        } catch (error) {
            alert("Erro ao salvar.");
        } finally {
            submitBtn.disabled = false;
        }
    });
}

function loadWeights(userId) {
    const q = query(collection(db, `users/${userId}/pesagens`), orderBy("date", "asc"));
    onSnapshot(q, (snapshot) => {
        globalWeights = [];
        snapshot.forEach((doc) => globalWeights.push({ id: doc.id, ...doc.data() }));
        updateDashboardCards(globalWeights);
        renderHistoryTable(globalWeights);
        window.dispatchEvent(new CustomEvent('weightsUpdated', { detail: globalWeights }));
    });
}

function updateDashboardCards(weights) {
    if (weights.length === 0) return;
    const currentWeight = weights[weights.length - 1].weight;
    const initialWeight = weights[0].weight;
    const totalLost = initialWeight - currentWeight;
    document.getElementById('current-weight').textContent = `${currentWeight.toFixed(1)} kg`;
    document.getElementById('total-lost').textContent = `${totalLost > 0 ? '-' : ''}${Math.abs(totalLost).toFixed(1)} kg`;

    const progressBar = document.getElementById('goal-progress-bar');
    const goalMessage = document.getElementById('goal-message');

    if (userGoalWeight && initialWeight > userGoalWeight) {
        const totalToLose = initialWeight - userGoalWeight;
        let percentage = ((initialWeight - currentWeight) / totalToLose) * 100;
        if (percentage < 0) percentage = 0;
        if (percentage > 100) percentage = 100;
        progressBar.style.width = `${percentage}%`;
        if (percentage >= 100) { goalMessage.textContent = "🏆 Meta alcançada!"; goalMessage.style.color = "var(--success)"; }
        else if (percentage >= 80) { goalMessage.textContent = `🔥 Falta apenas ${(currentWeight - userGoalWeight).toFixed(1)} kg!`; goalMessage.style.color = "var(--warning)"; }
        else { goalMessage.textContent = `${percentage.toFixed(1)}% do objetivo concluído.`; goalMessage.style.color = "var(--text-muted)"; }
    }
}

function renderHistoryTable(weights) {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';
    const reversedWeights = [...weights].reverse();
    reversedWeights.forEach((w, index) => {
        let variacao = "-"; let variacaoColor = "inherit";
        if (index < reversedWeights.length - 1) {
            const diff = w.weight - reversedWeights[index + 1].weight;
            if (diff > 0) { variacao = `+${diff.toFixed(1)} kg`; variacaoColor = "var(--primary)"; } 
            else if (diff < 0) { variacao = `${diff.toFixed(1)} kg`; variacaoColor = "var(--success)"; } 
            else { variacao = "0.0 kg"; }
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${w.date.split('-').reverse().join('/')}</td>
            <td><strong>${w.weight} kg</strong></td>
            <td style="color: ${variacaoColor}">${variacao}</td>
            <td class="text-muted">${w.notes || '-'}</td>
            <td>
                <button onclick="editRecord('${w.id}', '${w.date}', ${w.weight}, '${w.notes || ''}')" class="action-btn edit-btn"><span class="material-symbols-outlined">edit</span></button>
                <button onclick="deleteRecord('${w.id}')" class="action-btn delete-btn"><span class="material-symbols-outlined">delete</span></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ================== SISTEMA DE TREINO DINÂMICO ==================
let currentActiveDay = "Segunda"; 
let unsubscribeWorkout = null; 

function initTrainingDays() {
    const daysMap = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const today = daysMap[new Date().getDay()];
    
    document.querySelectorAll('.day-btn').forEach(btn => {
        if(btn.dataset.day === today) changeTrainingDay(btn);
        btn.addEventListener('click', (e) => changeTrainingDay(e.target));
    });
    
    if(!document.querySelector('.day-btn.active')) {
        changeTrainingDay(document.querySelector('.day-btn[data-day="Segunda"]'));
    }
}

function changeTrainingDay(btnElement) {
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    currentActiveDay = btnElement.dataset.day;
    document.getElementById('label-current-day').textContent = currentActiveDay;
    if (auth.currentUser) loadWorkoutsForDay(auth.currentUser.uid, currentActiveDay);
}

const workoutForm = document.getElementById('workout-form');

if (workoutForm) {
    workoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return;
        
        const name = document.getElementById('exercise-name').value;
        const numSets = parseInt(document.getElementById('exercise-sets').value) || 1;
        const reps = document.getElementById('exercise-reps').value;
        const weight = document.getElementById('exercise-weight').value;
        const btn = document.getElementById('add-exercise-btn');
        
        btn.disabled = true; 
        btn.textContent = 'Adicionando...';

        let initialSets = [];
        for(let i = 0; i < numSets; i++) {
            initialSets.push({ reps: reps, weight: weight, done: false });
        }

        try {
            await addDoc(collection(db, `users/${auth.currentUser.uid}/treinos`), {
                dayOfWeek: currentActiveDay,
                name: name,
                sets: initialSets,
                createdAt: Date.now() 
            });
            showToast(`Exercício adicionado!`);
            workoutForm.reset();
        } catch (error) {
            console.error(error);
            alert("Erro ao adicionar exercício.");
        } finally {
            btn.disabled = false; 
            btn.textContent = 'Adicionar';
        }
    });
}

function loadWorkoutsForDay(userId, day) {
    if (unsubscribeWorkout) unsubscribeWorkout();
    
    const q = query(collection(db, `users/${userId}/treinos`), where("dayOfWeek", "==", day));

    unsubscribeWorkout = onSnapshot(q, (snapshot) => {
        const workoutList = document.getElementById('workout-list');
        if(!workoutList) return;
        workoutList.innerHTML = '';
        
        if(snapshot.empty) {
            workoutList.innerHTML = `<p class="text-muted">Nenhum exercício cadastrado para <strong>${day}</strong>. Use o formulário acima.</p>`;
            return;
        }

        let exercises = [];
        snapshot.forEach(doc => exercises.push({ id: doc.id, ...doc.data() }));
        
        exercises.sort((a, b) => a.createdAt - b.createdAt);

        exercises.forEach((w) => {
            const id = w.id;
            const sets = w.sets || [];

            let setsHtml = sets.map((set, index) => `
                <div class="set-row">
                    <span class="set-number">${index + 1}ª Série</span>
                    <input type="number" class="set-input" placeholder="Reps" value="${set.reps}" onchange="updateSetData('${id}', ${index}, 'reps', this.value)">
                    <input type="number" class="set-input" placeholder="kg" value="${set.weight}" onchange="updateSetData('${id}', ${index}, 'weight', this.value)">
                    <input type="checkbox" class="set-check" ${set.done ? 'checked' : ''} onchange="updateSetData('${id}', ${index}, 'done', this.checked)">
                    <button onclick="removeSet('${id}', ${index})" class="action-btn delete-btn" title="Remover Série"><span class="material-symbols-outlined" style="font-size: 1rem;">close</span></button>
                </div>
            `).join('');

            const div = document.createElement('div');
            div.className = 'exercise-item';
            div.innerHTML = `
                <div class="exercise-header">
                    <h4>${w.name}</h4>
                    <button onclick="deleteExercise('${id}')" class="action-btn delete-btn" title="Excluir Exercício"><span class="material-symbols-outlined">delete</span></button>
                </div>
                <div class="sets-container">
                    ${setsHtml}
                    <button onclick="addSet('${id}')" class="add-set-btn">+ Adicionar Série Extra</button>
                </div>
            `;
            workoutList.appendChild(div);
        });
    });
}

window.updateSetData = async (exerciseId, setIndex, field, value) => {
    try {
        const docRef = doc(db, `users/${auth.currentUser.uid}/treinos`, exerciseId);
        const snap = await getDoc(docRef);
        if(snap.exists()) {
            let sets = snap.data().sets || [];
            if(sets[setIndex]) {
                sets[setIndex][field] = value;
                await updateDoc(docRef, { sets });
            }
        }
    } catch (e) { console.error("Erro ao atualizar série.", e); }
};

window.addSet = async (exerciseId) => {
    try {
        const docRef = doc(db, `users/${auth.currentUser.uid}/treinos`, exerciseId);
        const snap = await getDoc(docRef);
        if(snap.exists()) {
            let sets = snap.data().sets || [];
            const lastSet = sets.length > 0 ? sets[sets.length - 1] : { reps: '', weight: '' };
            sets.push({ reps: lastSet.reps, weight: lastSet.weight, done: false });
            await updateDoc(docRef, { sets });
        }
    } catch (e) { console.error(e); }
};

window.removeSet = async (exerciseId, setIndex) => {
    try {
        const docRef = doc(db, `users/${auth.currentUser.uid}/treinos`, exerciseId);
        const snap = await getDoc(docRef);
        if(snap.exists()) {
            let sets = snap.data().sets || [];
            sets.splice(setIndex, 1);
            await updateDoc(docRef, { sets });
        }
    } catch (e) { console.error(e); }
};

window.deleteExercise = async (id) => {
    if(confirm('Remover este exercício do treino?')) {
        await deleteDoc(doc(db, `users/${auth.currentUser.uid}/treinos`, id));
        showToast("Exercício removido.");
    }
};

document.getElementById('reset-day-btn')?.addEventListener('click', async () => {
    if(!confirm(`Deseja desmarcar todos os exercícios de ${currentActiveDay} para iniciar um novo treino?`)) return;
    
    const q = query(collection(db, `users/${auth.currentUser.uid}/treinos`), where("dayOfWeek", "==", currentActiveDay));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach(async (documento) => {
        const sets = documento.data().sets || [];
        const resetSets = sets.map(s => ({ ...s, done: false }));
        await updateDoc(doc(db, `users/${auth.currentUser.uid}/treinos`, documento.id), { sets: resetSets });
    });
    showToast(`Treino de ${currentActiveDay} zerado! Bora pra cima!`);
});

// ================== UTILITÁRIOS GLOBAIS ==================
function showToast(message, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === "success" ? "check_circle" : "info";
    toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "slide-out 0.4s ease-in forwards";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

window.editRecord = (id, date, weight, notes) => {
    document.querySelector('[data-target="view-dashboard"]').click();
    editIdInput.value = id; document.getElementById('weight-date').value = date; document.getElementById('weight-value').value = weight; document.getElementById('weight-notes').value = notes;
    formTitle.innerHTML = '<span class="material-symbols-outlined">edit</span> Editar Registro';
    submitBtn.textContent = 'Atualizar Evolução'; cancelEditBtn.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.deleteRecord = async (id) => { if(confirm('Deseja excluir este registro?')) { await deleteDoc(doc(db, `users/${auth.currentUser.uid}/pesagens`, id)); showToast("Registro excluído.", "primary"); } };
cancelEditBtn?.addEventListener('click', resetForm);
function resetForm() { weightForm.reset(); editIdInput.value = ''; formTitle.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Novo Registro'; submitBtn.textContent = 'Salvar Evolução'; cancelEditBtn.style.display = 'none'; document.getElementById('weight-date').valueAsDate = new Date(); }
document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));