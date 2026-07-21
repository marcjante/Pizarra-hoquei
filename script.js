(function(){
  // ---------- Elementos ----------
  const container = document.getElementById('rink-container');
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  const tokenLayer = document.getElementById('token-layer');

  // ---------- Estado ----------
  let mode = 'move';
  let tool = 'solid';
  let redCount = 0, blueCount = 0;
  let strokes = [];
  let currentStroke = null;
  let history = [];
  let historyIndex = -1;
  let isPlaying = false;
  let activeAnimations = [];
  let animLoopRunning = false;

  // ---------- Historial ----------
  function saveState() {
    const tokens = tokenLayer.querySelectorAll('div');
    const tokenData = Array.from(tokens).map(el => ({
      text: el.textContent,
      style: el.style.cssText,
      dataset: { ...el.dataset }
    }));
    const state = {
      strokes: JSON.parse(JSON.stringify(strokes)),
      tokens: tokenData,
      redCount, blueCount
    };
    history = history.slice(0, historyIndex + 1);
    history.push(state);
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
  }

  function restoreState(index) {
    if (index < 0 || index >= history.length) return;
    const state = history[index];
    strokes = state.strokes;
    redCount = state.redCount;
    blueCount = state.blueCount;
    tokenLayer.innerHTML = '';
    state.tokens.forEach(data => {
      const el = document.createElement('div');
      el.textContent = data.text || '';
      el.style.cssText = data.style || '';
      Object.keys(data.dataset || {}).forEach(k => el.dataset[k] = data.dataset[k]);
      tokenLayer.appendChild(el);
    });
    historyIndex = index;
    applyModeToTokens();
    redraw();
    updateUndoRedoButtons();
  }

  function undo() { if (historyIndex > 0) restoreState(historyIndex - 1); }
  function redo() { if (historyIndex < history.length - 1) restoreState(historyIndex + 1); }
  function updateUndoRedoButtons() {
    document.getElementById('undo-draw').disabled = (historyIndex <= 0);
    document.getElementById('redo-draw').disabled = (historyIndex >= history.length - 1);
  }

  // ---------- Dibujo ----------
  function drawShape(targetCtx, s) {
    targetCtx.save();
    targetCtx.strokeStyle = s.color;
    targetCtx.fillStyle = s.color;
    targetCtx.lineWidth = 3;
    targetCtx.lineJoin = 'round';
    targetCtx.lineCap = 'round';
    targetCtx.setLineDash([]);
    const x = s.x, y = s.y, r = 16;
    if (s.kind === 'circle') {
      targetCtx.globalAlpha = 0.18;
      targetCtx.beginPath();
      targetCtx.arc(x, y, r, 0, 2*Math.PI);
      targetCtx.fill();
      targetCtx.globalAlpha = 1;
      targetCtx.beginPath();
      targetCtx.arc(x, y, r, 0, 2*Math.PI);
      targetCtx.stroke();
    } else if (s.kind === 'triangle') {
      targetCtx.beginPath();
      targetCtx.moveTo(x, y-r);
      targetCtx.lineTo(x-r*0.9, y+r*0.75);
      targetCtx.lineTo(x+r*0.9, y+r*0.75);
      targetCtx.closePath();
      targetCtx.globalAlpha = 0.18;
      targetCtx.fill();
      targetCtx.globalAlpha = 1;
      targetCtx.stroke();
    } else if (s.kind === 'text') {
      targetCtx.font = '24px Arial, Helvetica, sans-serif';
      targetCtx.textAlign = 'left';
      targetCtx.textBaseline = 'top';
      targetCtx.fillText(s.text || 'Texto', x, y);
    }
    targetCtx.restore();
  }

  function renderStrokesOn(targetCtx) {
    strokes.forEach(s => {
      if (s.type === 'shape') {
        drawShape(targetCtx, s);
        return;
      }
      targetCtx.save();
      targetCtx.strokeStyle = s.color;
      targetCtx.lineWidth = 3;
      targetCtx.lineCap = 'round';
      targetCtx.lineJoin = 'round';
      if (s.lineStyle === 'dashed') targetCtx.setLineDash([10,7]);
      else if (s.lineStyle === 'dotted') targetCtx.setLineDash([3,9]);
      else targetCtx.setLineDash([]);
      targetCtx.beginPath();
      s.points.forEach((p,i) => {
        if (i===0) targetCtx.moveTo(p.x, p.y);
        else targetCtx.lineTo(p.x, p.y);
      });
      targetCtx.stroke();
      targetCtx.restore();
    });
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderStrokesOn(ctx);
  }

  // ---------- Tokens ----------
  function applyModeToTokens() {
    const tokens = tokenLayer.querySelectorAll('div');
    tokens.forEach(el => {
      el.style.pointerEvents = (mode === 'move') ? 'auto' : 'none';
      el.style.cursor = (mode === 'move') ? 'grab' : 'default';
    });
  }

  function makeToken(label, bg, fg, x, y, type = 'player') {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.background = bg;
    el.style.color = fg;
    el.style.fontSize = '15px';
    el.dataset.tokenType = type;
    tokenLayer.appendChild(el);
    // Eventos de arrastre y doble toque
    let isDragging = false;
    let startX, startY, origLeft, origTop;

    function startDrag(clientX, clientY) {
      if (mode !== 'move') return;
      isDragging = true;
      const rect = container.getBoundingClientRect();
      startX = clientX;
      startY = clientY;
      origLeft = parseFloat(el.style.left) || 0;
      origTop = parseFloat(el.style.top) || 0;
      el.style.transform = 'scale(1.15)';
      el.style.zIndex = '5';
    }

    function moveDrag(clientX, clientY) {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      const dx = clientX - startX;
      const dy = clientY - startY;
      const w = parseFloat(el.style.width) || 40;
      const h = parseFloat(el.style.height) || 40;
      let newLeft = origLeft + dx;
      let newTop = origTop + dy;
      newLeft = Math.max(0, Math.min(rect.width - w, newLeft));
      newTop = Math.max(0, Math.min(rect.height - h, newTop));
      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
    }

    function endDrag() {
      if (isDragging) {
        isDragging = false;
        el.style.transform = 'scale(1)';
        el.style.zIndex = '';
        saveState();
      }
    }

    // Touch
    el.addEventListener('touchstart', (e) => {
      if (mode !== 'move') return;
      e.preventDefault();
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd, { passive: false });
      document.addEventListener('touchcancel', onTouchEnd, { passive: false });
    }, { passive: false });

    function onTouchMove(e) {
      e.preventDefault();
      const touch = e.touches[0];
      moveDrag(touch.clientX, touch.clientY);
    }
    function onTouchEnd(e) {
      endDrag();
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    }

    // Mouse
    el.addEventListener('mousedown', (e) => {
      if (mode !== 'move') return;
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) { moveDrag(e.clientX, e.clientY); }
    function onMouseUp(e) { endDrag(); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }

    // Doble toque para eliminar
    let lastTap = 0;
    el.addEventListener('dblclick', (e) => {
      el.remove();
      saveState();
    });
    // También con doble toque en móvil (usamos pointerdown con timestamp)
    el.addEventListener('pointerdown', (e) => {
      const now = Date.now();
      if (now - lastTap < 350) {
        el.remove();
        saveState();
        e.preventDefault();
        return;
      }
      lastTap = now;
    });

    applyModeToTokens();
    return el;
  }

  // ---------- Utilidades de búsqueda ----------
  function findNearestPlayer(x, y) {
    const tokens = tokenLayer.querySelectorAll('div');
    let best = null, bestDist = 40;
    tokens.forEach(t => {
      if (t.dataset.tokenType !== 'player') return;
      const w = parseFloat(t.style.width) || 40;
      const h = parseFloat(t.style.height) || 40;
      const cx = parseFloat(t.style.left) + w/2;
      const cy = parseFloat(t.style.top) + h/2;
      const d = Math.hypot(cx-x, cy-y);
      if (d < bestDist) { bestDist = d; best = t; }
    });
    return best;
  }

  function findBallToken() {
    const tokens = tokenLayer.querySelectorAll('div');
    for (let t of tokens) if (t.dataset.tokenType === 'ball') return t;
    return null;
  }

  // ---------- Modo y herramientas ----------
  function setMode(m) {
    mode = m;
    document.getElementById('mode-move').classList.toggle('active', m==='move');
    document.getElementById('mode-draw').classList.toggle('active', m==='draw');
    canvas.style.pointerEvents = (m==='draw') ? 'auto' : 'none';
    canvas.style.cursor = (m==='draw') ? 'crosshair' : 'default';
    applyModeToTokens();
  }

  function setTool(t) {
    tool = t;
    ['solid','dotted','dashed','triangle','circle','text'].forEach(k => {
      document.getElementById('tool-'+k).classList.toggle('active', k===t);
    });
  }

  // ---------- Dibujo en canvas (eventos táctiles + ratón) ----------
  function startDraw(clientX, clientY) {
    if (mode !== 'draw') return;
    const rect = canvas.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    const color = document.getElementById('pen-color').value;

    if (['solid','dotted','dashed'].includes(tool)) {
      // Para 'dashed' (Movimiento) vinculamos a la bola, para los otros al jugador
      let linkedToken = null;
      if (tool === 'dashed') {
        linkedToken = findBallToken();
      } else {
        linkedToken = findNearestPlayer(x, y);
      }
      let lineColor = color;
      let tokenStart = null, tokenW = null, tokenH = null;
      if (linkedToken) {
        tokenW = parseFloat(linkedToken.style.width) || 40;
        tokenH = parseFloat(linkedToken.style.height) || 40;
        x = parseFloat(linkedToken.style.left) + tokenW/2;
        y = parseFloat(linkedToken.style.top) + tokenH/2;
        tokenStart = { left: parseFloat(linkedToken.style.left), top: parseFloat(linkedToken.style.top) };
        lineColor = linkedToken.style.background;
      }
      currentStroke = {
        type: 'line',
        color: lineColor,
        lineStyle: tool,
        points: [{x,y}],
        linkedToken: linkedToken,
        tokenStart: tokenStart,
        tokenW: tokenW,
        tokenH: tokenH
      };
      strokes.push(currentStroke);
    } else if (tool === 'text') {
      const txt = prompt('Introduce el texto:', 'Anotación');
      if (txt !== null && txt.trim() !== '') {
        strokes.push({ type: 'shape', kind: 'text', color: color, x: x, y: y, text: txt });
        redraw();
        saveState();
      }
      currentStroke = null;
    } else {
      // Formas: triangle, circle
      strokes.push({ type: 'shape', kind: tool, color: color, x: x, y: y });
      currentStroke = null;
      redraw();
      saveState();
    }
  }

  function moveDraw(clientX, clientY) {
    if (!currentStroke) return;
    const rect = canvas.getBoundingClientRect();
    currentStroke.points.push({ x: clientX - rect.left, y: clientY - rect.top });
    redraw();
  }

  function endDraw() {
    if (currentStroke && currentStroke.type === 'line' && currentStroke.points.length > 1) {
      // No iniciamos animación automáticamente
    } else if (currentStroke) {
      strokes.pop();
      redraw();
    }
    currentStroke = null;
    saveState();
  }

  // Touch events on canvas
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    startDraw(touch.clientX, touch.clientY);
    if (currentStroke) {
      document.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
      document.addEventListener('touchend', onCanvasTouchEnd, { passive: false });
      document.addEventListener('touchcancel', onCanvasTouchEnd, { passive: false });
    }
  }, { passive: false });

  function onCanvasTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    moveDraw(touch.clientX, touch.clientY);
  }
  function onCanvasTouchEnd(e) {
    endDraw();
    document.removeEventListener('touchmove', onCanvasTouchMove);
    document.removeEventListener('touchend', onCanvasTouchEnd);
    document.removeEventListener('touchcancel', onCanvasTouchEnd);
  }

  // Mouse events on canvas
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startDraw(e.clientX, e.clientY);
    if (currentStroke) {
      document.addEventListener('mousemove', onCanvasMouseMove);
      document.addEventListener('mouseup', onCanvasMouseUp);
    }
  });

  function onCanvasMouseMove(e) { moveDraw(e.clientX, e.clientY); }
  function onCanvasMouseUp(e) { endDraw(); document.removeEventListener('mousemove', onCanvasMouseMove); document.removeEventListener('mouseup', onCanvasMouseUp); }

  // ---------- Animación ----------
  function drawMarker(targetCtx, x, y, dashed, color) {
    targetCtx.save();
    if (dashed) {
      targetCtx.fillStyle = '#f5efe2';
      targetCtx.strokeStyle = '#141414';
      targetCtx.lineWidth = 1.5;
      targetCtx.beginPath();
      targetCtx.arc(x, y, 8, 0, 2*Math.PI);
      targetCtx.fill();
      targetCtx.stroke();
      targetCtx.strokeStyle = '#141414';
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      targetCtx.arc(x-2, y-2, 3, 0, 2*Math.PI);
      targetCtx.stroke();
      targetCtx.beginPath();
      targetCtx.moveTo(x-6, y+3);
      targetCtx.lineTo(x+6, y+3);
      targetCtx.stroke();
    } else {
      targetCtx.fillStyle = color;
      targetCtx.strokeStyle = 'rgba(0,0,0,0.4)';
      targetCtx.lineWidth = 1.5;
      targetCtx.beginPath();
      targetCtx.arc(x, y, 11, 0, 2*Math.PI);
      targetCtx.fill();
      targetCtx.stroke();
    }
    targetCtx.restore();
  }

  function startAnimation(stroke, onComplete) {
    const pts = stroke.points;
    if (pts.length < 2) return;
    let lengths = [], total = 0;
    for (let i=1; i<pts.length; i++) {
      const d = Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
      lengths.push(d);
      total += d;
    }
    if (total === 0) return;
    const duration = Math.max(700, Math.min(3000, total * 5));
    if (stroke.linkedToken && stroke.tokenStart) {
      stroke.linkedToken.style.left = stroke.tokenStart.left + 'px';
      stroke.linkedToken.style.top = stroke.tokenStart.top + 'px';
    }
    activeAnimations.push({
      stroke, lengths, total, duration,
      startTime: null,
      onComplete: onComplete || null
    });
    if (!animLoopRunning) {
      animLoopRunning = true;
      requestAnimationFrame(animLoop);
    }
  }

  function animLoop(ts) {
    redraw();
    const toRemove = [];
    activeAnimations.forEach((a, idx) => {
      if (a.startTime === null) a.startTime = ts;
      const elapsed = ts - a.startTime;
      const progress = Math.min(1, elapsed / a.duration);
      const distTarget = progress * a.total;
      let acc = 0, i = 0;
      while (i < a.lengths.length - 1 && acc + a.lengths[i] < distTarget) {
        acc += a.lengths[i];
        i++;
      }
      const pts = a.stroke.points;
      const segStart = pts[i], segEnd = pts[i+1] || pts[i];
      const segLen = a.lengths[i] || 1;
      const segProgress = segLen ? (distTarget - acc) / segLen : 1;
      const x = segStart.x + (segEnd.x - segStart.x) * segProgress;
      const y = segStart.y + (segEnd.y - segStart.y) * segProgress;
      if (a.stroke.linkedToken) {
        const w = a.stroke.tokenW || 40;
        const h = a.stroke.tokenH || 40;
        a.stroke.linkedToken.style.left = (x - w/2) + 'px';
        a.stroke.linkedToken.style.top = (y - h/2) + 'px';
      } else {
        drawMarker(ctx, x, y, (a.stroke.lineStyle === 'dashed'), a.stroke.color);
      }
      const finished = (a.startTime !== null) && ((ts - a.startTime) >= a.duration);
      if (finished) {
        toRemove.push(idx);
        if (a.onComplete) a.onComplete();
      }
    });
    for (let k = toRemove.length - 1; k >= 0; k--) {
      activeAnimations.splice(toRemove[k], 1);
    }
    if (activeAnimations.length > 0) {
      requestAnimationFrame(animLoop);
    } else {
      animLoopRunning = false;
      redraw();
    }
  }

  // Reproducir todas las líneas en orden
  document.getElementById('play-anim').addEventListener('click', function() {
    if (isPlaying) return;
    const lineStrokes = strokes.filter(s => s.type === 'line');
    if (lineStrokes.length === 0) {
      alert('No hay líneas para reproducir.');
      return;
    }
    activeAnimations = [];
    const resetDone = new Set();
    lineStrokes.forEach(s => {
      if (s.linkedToken && s.tokenStart && !resetDone.has(s.linkedToken)) {
        s.linkedToken.style.left = s.tokenStart.left + 'px';
        s.linkedToken.style.top = s.tokenStart.top + 'px';
        resetDone.add(s.linkedToken);
      }
    });
    redraw();
    isPlaying = true;
    const btn = this;
    const origText = btn.textContent;
    btn.textContent = '⏳';
    btn.disabled = true;

    let i = 0;
    function playNext() {
      if (i >= lineStrokes.length) {
        isPlaying = false;
        btn.textContent = origText;
        btn.disabled = false;
        return;
      }
      const s = lineStrokes[i];
      i++;
      startAnimation(s, playNext);
    }
    if (!animLoopRunning) {
      animLoopRunning = true;
      requestAnimationFrame(function(ts) {
        playNext();
        animLoop(ts);
      });
    } else {
      playNext();
    }
  });

  // ---------- Botones de añadir ----------
  document.getElementById('add-red').addEventListener('click', () => {
    redCount++;
    makeToken(String(redCount), '#e5484d', '#fff', 40 + ((redCount-1)%6)*42, 200);
    saveState();
  });
  document.getElementById('add-blue').addEventListener('click', () => {
    blueCount++;
    makeToken(String(blueCount), '#3b82f6', '#fff', 40 + ((blueCount-1)%6)*42, 500);
    saveState();
  });
  document.getElementById('add-gk').addEventListener('click', () => {
    makeToken('P', '#f0c419', '#3a2a00', 230, 60);
    saveState();
  });
  document.getElementById('add-ball').addEventListener('click', () => {
    const el = makeToken('', '#f5efe2', '#000', 237, 348, 'ball');
    el.style.width = '26px';
    el.style.height = '26px';
    el.style.fontSize = '0';
    saveState();
  });

  document.getElementById('clear-players').addEventListener('click', () => {
    if (confirm('Eliminar todos los jugadores y bola?')) {
      tokenLayer.innerHTML = '';
      redCount = 0; blueCount = 0;
      saveState();
    }
  });

  document.getElementById('clear-draw').addEventListener('click', () => {
    strokes = [];
    redraw();
    saveState();
  });

  document.getElementById('undo-draw').addEventListener('click', undo);
  document.getElementById('redo-draw').addEventListener('click', redo);

  // ---------- Guardar JPG ----------
  document.getElementById('save-jpg').addEventListener('click', function() {
    const svgEl = document.getElementById('rink-svg');
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = function() {
      const expCanvas = document.createElement('canvas');
      expCanvas.width = canvas.width;
      expCanvas.height = canvas.height;
      const ectx = expCanvas.getContext('2d');
      ectx.fillStyle = '#141414';
      ectx.fillRect(0,0,expCanvas.width,expCanvas.height);
      ectx.drawImage(img, 0, 0, expCanvas.width, expCanvas.height);
      ectx.drawImage(canvas, 0, 0);
      // Dibujar tokens
      const tokens = tokenLayer.querySelectorAll('div');
      tokens.forEach(t => {
        const x = parseFloat(t.style.left) || 0;
        const y = parseFloat(t.style.top) || 0;
        const w = parseFloat(t.style.width) || 40;
        const h = parseFloat(t.style.height) || 40;
        ectx.fillStyle = t.style.background;
        ectx.beginPath();
        ectx.arc(x+w/2, y+h/2, w/2, 0, 2*Math.PI);
        ectx.fill();
        ectx.strokeStyle = 'rgba(0,0,0,0.35)';
        ectx.lineWidth = 1.5;
        ectx.stroke();
        if (t.textContent) {
          ectx.fillStyle = t.style.color || '#fff';
          ectx.font = '600 13px Arial';
          ectx.textAlign = 'center';
          ectx.textBaseline = 'middle';
          ectx.fillText(t.textContent, x+w/2, y+h/2+1);
        }
      });
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = 'pizarra_hockey.jpg';
      link.href = expCanvas.toDataURL('image/jpeg', 0.92);
      link.click();
    };
    img.src = url;
  });

  // ---------- Guardar Vídeo ----------
  document.getElementById('save-video').addEventListener('click', function() {
    const lineStrokes = strokes.filter(s => s.type === 'line' && s.points.length > 1);
    if (lineStrokes.length === 0) {
      alert('Dibuja al menos una línea antes de grabar vídeo.');
      return;
    }
    const btn = this;
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Generando...';

    const w = canvas.width, h = canvas.height;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d');

    // Cargar fondo SVG
    const svgEl = document.getElementById('rink-svg');
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    const bgImg = new Image();
    bgImg.onload = function() {
      // Preparar datos de animación
      const animsData = lineStrokes.map(s => {
        const pts = s.points;
        let lengths = [], total = 0;
        for (let i=1; i<pts.length; i++) {
          const d = Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
          lengths.push(d);
          total += d;
        }
        const duration = Math.max(700, Math.min(3000, total * 5));
        return { stroke: s, lengths, total, duration };
      });
      let offsets = [], acc = 0;
      animsData.forEach(a => { offsets.push(acc); acc += a.duration; });
      const totalDuration = acc + 800;

      // Función para dibujar un fotograma en offCtx
      function drawFrame(time) {
        const elapsed = time;
        offCtx.clearRect(0,0,w,h);
        offCtx.drawImage(bgImg, 0, 0, w, h);
        renderStrokesOn(offCtx);

        // Marcadores y tokens en movimiento
        const overrides = new Map();
        animsData.forEach((a, idx) => {
          const localT = elapsed - offsets[idx];
          const prog = localT <= 0 ? 0 : (localT >= a.duration ? 1 : localT / a.duration);
          const distTarget = prog * a.total;
          let acc2 = 0, i = 0;
          while (i < a.lengths.length - 1 && acc2 + a.lengths[i] < distTarget) {
            acc2 += a.lengths[i];
            i++;
          }
          const pts = a.stroke.points;
          const segStart = pts[i], segEnd = pts[i+1] || pts[i];
          const segLen = a.lengths[i] || 1;
          const segProgress = segLen ? (distTarget - acc2) / segLen : 1;
          const x = segStart.x + (segEnd.x - segStart.x) * segProgress;
          const y = segStart.y + (segEnd.y - segStart.y) * segProgress;
          if (a.stroke.linkedToken) {
            overrides.set(a.stroke.linkedToken, { x, y });
          } else if (localT >= 0 && localT <= a.duration) {
            drawMarker(offCtx, x, y, (a.stroke.lineStyle === 'dashed'), a.stroke.color);
          }
        });

        // Dibujar tokens estáticos y los que se mueven
        const tokens = tokenLayer.querySelectorAll('div');
        tokens.forEach(t => {
          let cx, cy;
          if (overrides.has(t)) {
            const o = overrides.get(t);
            cx = o.x; cy = o.y;
          } else {
            cx = parseFloat(t.style.left) + (parseFloat(t.style.width)||40)/2;
            cy = parseFloat(t.style.top) + (parseFloat(t.style.height)||40)/2;
          }
          const w2 = parseFloat(t.style.width) || 40;
          const h2 = parseFloat(t.style.height) || 40;
          offCtx.fillStyle = t.style.background;
          offCtx.beginPath();
          offCtx.arc(cx, cy, w2/2, 0, 2*Math.PI);
          offCtx.fill();
          offCtx.strokeStyle = 'rgba(0,0,0,0.35)';
          offCtx.lineWidth = 1.5;
          offCtx.stroke();
          if (t.textContent) {
            offCtx.fillStyle = t.style.color || '#fff';
            offCtx.font = '600 13px Arial';
            offCtx.textAlign = 'center';
            offCtx.textBaseline = 'middle';
            offCtx.fillText(t.textContent, cx, cy+1);
          }
        });
      }

      // Captura
      const stream = offCanvas.captureStream(30);
      const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      let mimeType = null;
      for (let mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
      }
      if (!mimeType) {
        alert('Tu navegador no soporta grabación de vídeo WebM.');
        btn.disabled = false;
        btn.textContent = origText;
        return;
      }
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = function() {
        const blob = new Blob(chunks, { type: mimeType });
        const url2 = URL.createObjectURL(blob);
        const videoEl = document.getElementById('video-preview');
        const downloadLink = document.getElementById('video-download');
        videoEl.src = url2;
        downloadLink.href = url2;
        downloadLink.download = 'pizarra_hockey.webm';
        document.getElementById('video-result').style.display = 'block';
        btn.disabled = false;
        btn.textContent = origText;
      };
      recorder.start(1000/30);

      // Resetear tokens a posiciones iniciales
      const resetDone = new Set();
      lineStrokes.forEach(s => {
        if (s.linkedToken && s.tokenStart && !resetDone.has(s.linkedToken)) {
          s.linkedToken.style.left = s.tokenStart.left + 'px';
          s.linkedToken.style.top = s.tokenStart.top + 'px';
          resetDone.add(s.linkedToken);
        }
      });
      redraw();

      const startTime = performance.now();
      function renderLoop(now) {
        const elapsed = now - startTime;
        if (elapsed >= totalDuration) {
          drawFrame(totalDuration);
          recorder.stop();
          return;
        }
        drawFrame(elapsed);
        requestAnimationFrame(renderLoop);
      }
      requestAnimationFrame(renderLoop);
    };
    bgImg.src = url;
  });

  // ---------- Inicialización ----------
  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redraw();
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 50);

  // Eventos de modo y herramientas
  document.getElementById('mode-move').addEventListener('click', () => setMode('move'));
  document.getElementById('mode-draw').addEventListener('click', () => setMode('draw'));
  ['solid','dotted','dashed','triangle','circle','text'].forEach(id => {
    document.getElementById('tool-'+id).addEventListener('click', function() {
      setTool(id);
    });
  });
  setTool('solid');
  setMode('move');
  updateUndoRedoButtons();
  saveState(); // guardar estado inicial
})();
