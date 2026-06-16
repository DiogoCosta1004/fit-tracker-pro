import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, addDoc, deleteDoc, query, orderBy, onSnapshot, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let nutriChartObj = null;
let unsubscribeDiet = null;

// ================= AUTENTICAÇÃO =================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'nutri') {
            document.getElementById('user-greeting').textContent = `Dr(a). ${userDoc.data().firstName || 'Nutricionista'}`;
            loadPatients();
        } else {
            window.location.href = 'dashboard.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// ================= CARREGAR ALUNOS =================
async function loadPatients() {
    const container = document.getElementById('patients-container');
    container.innerHTML = '';

    try {
        const q = query(collection(db, "users"), where("role", "==", "aluno"));
        const snapshot = await getDocs(q);

        if(snapshot.empty) {
            container.innerHTML = '<p class="text-muted" style="font-size: 0.9rem;">Nenhum aluno encontrado.</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const student = docSnap.data();
            const div = document.createElement('div');
            div.className = 'patient-item';
            div.innerHTML = `
                <div><h4>${student.firstName} ${student.lastName || ''}</h4></div>
                <span class="material-symbols-outlined" style="color: var(--text-muted); font-size: 1.2rem;">chevron_right</span>
            `;
            
            div.addEventListener('click', () => {
                document.querySelectorAll('.patient-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                openPatientProfile(docSnap.id, student);
            });

            container.appendChild(div);
        });
    } catch (error) {
        console.error("Erro ao buscar alunos:", error);
    }
}

// ================= ABRIR PRONTUÁRIO DO ALUNO =================
async function openPatientProfile(studentId, studentData) {
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('patient-details').style.display = 'block';
    
    document.getElementById('active-patient-name').textContent = `${studentData.firstName} ${studentData.lastName || ''}`;
    document.getElementById('active-patient-email').textContent = studentData.email;
    document.getElementById('active-patient-goal').textContent = studentData.goalWeight ? `${studentData.goalWeight} kg` : 'Não definida';
    document.getElementById('selected-patient-id').value = studentId;

    document.getElementById('target-cals').value = studentData.targetCals || '';
    document.getElementById('target-protein').value = studentData.targetProtein || '';
    document.getElementById('target-carbs').value = studentData.targetCarbs || '';
    document.getElementById('target-fats').value = studentData.targetFats || '';

    // Carrega gráfico
    const qWeights = query(collection(db, `users/${studentId}/pesagens`), orderBy("date", "asc"));
    const snapshotWeights = await getDocs(qWeights);
    const weights = [];
    snapshotWeights.forEach(doc => weights.push({ id: doc.id, ...doc.data() }));
    renderNutriChart(weights);

    // Carrega Dieta em Tempo Real
    loadPrescribedDiet(studentId);
}

// ================= GRÁFICO =================
function renderNutriChart(weights) {
    const canvas = document.getElementById('nutriEvolutionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = weights.map(w => w.date.split('-').reverse().slice(0,2).join('/'));
    const data = weights.map(w => Number(w.weight));

    if (nutriChartObj) nutriChartObj.destroy();
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(0, 242, 254, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 242, 254, 0.0)');

    nutriChartObj = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso (kg)', data: data, borderColor: '#00F2FE', backgroundColor: gradient,
                borderWidth: 3, pointBackgroundColor: '#0F172A', pointBorderColor: '#00F2FE', tension: 0.4, fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: {
                y: { suggestedMin: Math.min(...data) - 2, suggestedMax: Math.max(...data) + 2, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
            }
        }
    });
}

// ================= METAS DE MACROS =================
document.getElementById('prescribe-macros-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('selected-patient-id').value;
    const btn = document.getElementById('save-macros-btn');
    
    btn.textContent = 'Salvando...'; btn.disabled = true;

    try {
        await updateDoc(doc(db, "users", studentId), {
            targetCals: parseInt(document.getElementById('target-cals').value),
            targetProtein: parseInt(document.getElementById('target-protein').value),
            targetCarbs: parseInt(document.getElementById('target-carbs').value),
            targetFats: parseInt(document.getElementById('target-fats').value)
        });
        showToast("Alvos globais atualizados!");
    } catch (error) {
        alert("Erro ao prescrever macros.");
    } finally {
        btn.textContent = 'Salvar Alvos'; btn.disabled = false;
    }
});

// ================= CRUD DE DIETA =================
document.getElementById('add-meal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('selected-patient-id').value;
    if(!studentId) return alert("Selecione um aluno primeiro.");

    const btn = document.getElementById('add-food-btn');
    btn.textContent = 'Adicionando...'; btn.disabled = true;

    const mealData = {
        mealType: document.getElementById('meal-type').value,
        name: document.getElementById('food-name').value,
        weight: parseInt(document.getElementById('food-weight').value),
        cals: parseInt(document.getElementById('food-cals').value),
        protein: parseFloat(document.getElementById('food-protein').value),
        carbs: parseFloat(document.getElementById('food-carbs').value),
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, `users/${studentId}/dieta_prescrita`), mealData);
        showToast("Alimento adicionado à dieta!");
        
        // Limpa apenas os inputs, mas mantém a refeição selecionada (pra facilitar inserir vários na mesma refeição)
        document.getElementById('food-name').value = '';
        document.getElementById('food-weight').value = '';
        document.getElementById('food-cals').value = '';
        document.getElementById('food-protein').value = '';
        document.getElementById('food-carbs').value = '';
        document.getElementById('food-name').focus();
    } catch (error) {
        console.error(error);
        alert("Erro ao adicionar alimento.");
    } finally {
        btn.textContent = 'Adicionar à Dieta'; btn.disabled = false;
    }
});

function loadPrescribedDiet(studentId) {
    if (unsubscribeDiet) unsubscribeDiet();
    
    const q = query(collection(db, `users/${studentId}/dieta_prescrita`), orderBy("timestamp", "asc"));
    
    unsubscribeDiet = onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById('prescribed-diet-list');
        listEl.innerHTML = '';

        if(snapshot.empty) {
            listEl.innerHTML = '<p class="text-muted">Nenhum alimento prescrito ainda.</p>';
            return;
        }

        // Agrupa os itens pela Refeição (Café da Manhã, Almoço, etc)
        const dietGroups = {};
        snapshot.forEach(docSnap => {
            const food = docSnap.data();
            if(!dietGroups[food.mealType]) dietGroups[food.mealType] = [];
            dietGroups[food.mealType].push({ id: docSnap.id, ...food });
        });

        // Ordem fixa de exibição
        const order = ["Café da Manhã", "Almoço", "Lanche da Tarde", "Jantar", "Ceia"];
        
        order.forEach(meal => {
            if(dietGroups[meal]) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'diet-group';
                
                let totalCals = 0; let totalProt = 0;
                
                let itemsHtml = dietGroups[meal].map(f => {
                    totalCals += f.cals || 0;
                    totalProt += f.protein || 0;
                    return `
                        <div class="diet-item">
                            <div class="diet-item-info">
                                <strong>${f.weight}g - ${f.name}</strong>
                                <small>${f.cals} kcal | Prot: ${f.protein}g | Carb: ${f.carbs}g</small>
                            </div>
                            <button onclick="deleteFood('${studentId}', '${f.id}')" class="action-btn delete-btn" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
                        </div>
                    `;
                }).join('');

                groupDiv.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <h4>${meal}</h4>
                        <small class="text-muted">Total: ${totalCals} kcal | Prot: ${totalProt}g</small>
                    </div>
                    ${itemsHtml}
                `;
                listEl.appendChild(groupDiv);
            }
        });
    });
}

window.deleteFood = async (studentId, foodId) => {
    if(confirm("Remover este alimento da dieta?")) {
        await deleteDoc(doc(db, `users/${studentId}/dieta_prescrita`, foodId));
        showToast("Alimento removido da prescrição.");
    }
};

// ================= UTILITÁRIOS =================
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-success`;
    toast.innerHTML = `<span class="material-symbols-outlined">check_circle</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = "slide-out 0.4s ease-in forwards"; setTimeout(() => toast.remove(), 400); }, 3000);
}

// ================= CONVIDAR ALUNO =================
const inviteBtn = document.getElementById('invite-student-btn');
if(inviteBtn) {
    inviteBtn.addEventListener('click', () => {
        // Agora o link carrega o parâmetro ?action=register
        const linkCadastro = window.location.href.replace('nutri-dashboard.html', 'login.html?action=register');
        
        navigator.clipboard.writeText(linkCadastro).then(() => {
            alert(`Link copiado: ${linkCadastro}\n\nEnvie este link para o aluno. A tela de cadastro já abrirá automaticamente para ele!`);
        });
    });
}

document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));