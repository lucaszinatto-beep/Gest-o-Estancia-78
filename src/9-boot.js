/* Inicialização */
if (window.Chart) { Chart.defaults.font.family = 'Inter'; Chart.defaults.color = '#4d5650'; }
route();
initDB().catch(e => { console.error(e); semBanco('Erro ao conectar ao banco: '+(e.message||e)); });
