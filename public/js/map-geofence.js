document.addEventListener('DOMContentLoaded', () => {
    const btnSimulate = document.getElementById('btn-simulate-gps');
    
    if (!btnSimulate) return;

    btnSimulate.addEventListener('click', () => {
        if (!window.SafeMap || typeof window.SafeMap.getReports !== 'function') {
            alert('El mapa aún no está listo. Espera un segundo.');
            return;
        }

        const reports = window.SafeMap.getReports();
        if (reports.length === 0) {
            alert("No hay reportes activos en el mapa para simular.");
            return;
        }

        // Tomamos el primer reporte activo y nos "teletransportamos" a ~100m de él
        const target = reports[0];
        const simulatedLat = parseFloat(target.lat) + 0.0009; // Aprox 100 metros
        const simulatedLng = parseFloat(target.lng);

        console.log("📍 Simulando GPS: Teletransportando a 100m de", target.title);

        // Disparamos la alerta visual como si el GPS original la hubiera detectado
        if (window.SafeMapUX && typeof window.SafeMapUX.showToastUX === 'function') {
            window.SafeMapUX.showToastUX(`⚠️ Precaución: ${target.title} a 100 metros de ti`, 'default');
            
            // Vibrar el teléfono si está disponible (en PC no hace nada, pero en Android vibra)
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        }
    });
});