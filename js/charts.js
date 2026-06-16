let evolutionChartObj = null;

window.addEventListener('weightsUpdated', (e) => {
    const weights = e.detail;
    renderEvolutionChart(weights);
});

function renderEvolutionChart(weights) {
    const canvas = document.getElementById('evolutionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Formata os rótulos e GARANTE que os pesos sejam números (evita o gráfico quebrado)
    const labels = weights.map(w => {
        const parts = w.date.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
        return w.date;
    });
    
    // Number() assegura a conversão correta para a escala Y
    const data = weights.map(w => Number(w.weight));

    // Destrói o gráfico antigo
    if (evolutionChartObj) {
        evolutionChartObj.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(255, 94, 58, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 94, 58, 0.0)');

    evolutionChartObj = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso (kg)',
                data: data,
                borderColor: '#FF5E3A',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#0F172A',
                pointBorderColor: '#FF5E3A',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Só funciona bem porque agora a div pai tem height: 300px
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E293B',
                    titleColor: '#F8FAFC',
                    bodyColor: '#00F2FE',
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} kg`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    // Impede que o gráfico comece do zero e "esmague" a linha
                    suggestedMin: Math.min(...data) - 2,
                    suggestedMax: Math.max(...data) + 2,
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#94A3B8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94A3B8' }
                }
            }
        }
    });
}