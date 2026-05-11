document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const gameArea = document.getElementById('game-area');
    const overlay = document.getElementById('overlay');
    const timerDisplay = document.getElementById('timer');
    const targetDisplay = document.getElementById('target-num');
    const resultModal = document.getElementById('result-modal');
    const finalTimeDisplay = document.getElementById('final-time');
    const finalGradeDisplay = document.getElementById('final-grade');
    const totalNumbersInput = document.getElementById('total-numbers');
    const distractorStrengthInput = document.getElementById('distractor-strength');
    const visualNoiseInput = document.getElementById('visual-noise');
    const targetSimilarityInput = document.getElementById('target-similarity');
    const focusBlockDisplay = document.getElementById('focus-block');
    const focusLoadDisplay = document.getElementById('focus-load');

    // Check if D3 is loaded
    if (typeof d3 === 'undefined') {
        alert("错误: D3.js 库加载失败。请确保 d3.v7.min.js 文件存在于项目目录中。");
        startBtn.disabled = true;
        startBtn.textContent = "组件缺失";
        return;
    }

    const svg = d3.select("#game-svg");

    let currentTarget = 1;
    let startTime = 0;
    let timerInterval = null;
    let isPlaying = false;
    let isAdvancedMode = false;
    let totalNumbers = 100;
    let sessionStartedAt = null;
    let sessionSaved = false;
    let trials = [];
    let targetPresentedAt = 0;
    let lastResponseAt = 0;
    const BLOCK_SIZE = 20;
    const MIN_DEADLINE_MS = 2500;
    const MAX_DEADLINE_MS = 9500;
    let adaptiveState = null;
    let blockSummaries = [];
    let loadHistory = [];
    let targetDeadlineTimer = null;
    let omittedTargets = new Set();
    let completedTargets = new Set();
    let targetConditions = new Map();
    let cellByNumber = new Map();
    let textByNumber = new Map();
    let cellMetadata = new Map();
    let textGroupSelection = null;
    let noiseGroupSelection = null;
    let interferenceGroupSelection = null;
    let layoutBounds = { width: 0, height: 0 };
    let activeTargetCondition = null;

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        resetGame(); // Just reset to initial state, don't auto-start
    });
    
    // Mode selection handler
    document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            isAdvancedMode = e.target.value === 'advanced';
        });
    });

    // Validate number input
    totalNumbersInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 100) val = 100;
        e.target.value = val;
    });

    [distractorStrengthInput, visualNoiseInput, targetSimilarityInput].forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            input.value = normalizeRangeValue(input.value, 0, 100);
        });
    });

    function startGame() {
        if (isPlaying) return;
        
        // Get total numbers from input
        totalNumbers = parseInt(totalNumbersInput.value) || 100;
        
        try {
            resetGame();
            initializeTrainingState();
            
            // Wait for layout calculation
            setTimeout(() => {
                try {
                    generateShatteredLayout();
                    const now = Date.now();
                    sessionStartedAt = new Date(now);
                    sessionSaved = false;
                    trials = [];
                    startTime = now;
                    lastResponseAt = now;
                    isPlaying = true;
                    beginTargetTrial(currentTarget, now);
                    timerInterval = setInterval(updateTimer, 1000);
                    overlay.classList.add('hidden');
                    startBtn.disabled = true;
                    startBtn.textContent = "进行中...";
                    totalNumbersInput.disabled = true; // Disable input during game
                    setLoadInputsDisabled(true);
                } catch (e) {
                    console.error("Layout generation failed:", e);
                    alert("生成布局时出错: " + e.message);
                    resetGame();
                }
            }, 50);
        } catch (e) {
            console.error("Game start failed:", e);
            alert("游戏启动失败: " + e.message);
        }
    }

    function resetGame() {
        currentTarget = 1;
        targetDisplay.textContent = currentTarget;
        timerDisplay.textContent = "00:00";
        if (timerInterval) clearInterval(timerInterval);
        clearTargetDeadline();
        svg.selectAll("*").remove(); // Clear SVG
        isPlaying = false;
        sessionStartedAt = null;
        sessionSaved = false;
        trials = [];
        targetPresentedAt = 0;
        lastResponseAt = 0;
        adaptiveState = null;
        blockSummaries = [];
        loadHistory = [];
        omittedTargets = new Set();
        completedTargets = new Set();
        targetConditions = new Map();
        cellByNumber = new Map();
        textByNumber = new Map();
        cellMetadata = new Map();
        textGroupSelection = null;
        noiseGroupSelection = null;
        interferenceGroupSelection = null;
        layoutBounds = { width: 0, height: 0 };
        activeTargetCondition = null;
        startBtn.disabled = false;
        startBtn.textContent = "开始测试";
        totalNumbersInput.disabled = false;
        setLoadInputsDisabled(false);
        updateTrainingHud();
    }

    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${minutes}:${seconds}`;
    }

    // --- Shattered Layout Logic (Recursive Splitting) ---

    function generateShatteredLayout() {
        const rect = gameArea.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        if (width <= 0 || height <= 0) {
            throw new Error(`Game area dimensions are invalid: ${width}x${height}`);
        }
        layoutBounds = { width, height };

        // Force set SVG dimensions
        svg.attr("width", width)
           .attr("height", height)
           .attr("viewBox", `0 0 ${width} ${height}`);

        // Initial Polygon (Full Screen)
        const initialPoly = [[0, 0], [width, 0], [width, height], [0, height]];
        
        // Generate Polygons
        // To get uniform sizes, we must ensure n=1 leaves are roughly same area.
        // The recursive split allocates n1 and n2 based on area ratio.
        // This is ALREADY trying to be fair.
        // The issue is likely randomness in the CUT placement.
        // If we cut near the edge, one piece is tiny, but 'n' is also small?
        // Ah, if we cut a 10-area poly into 1 and 9, and n=10.
        // Then piece 1 gets n=1, piece 2 gets n=9.
        // Piece 1 area/n = 1/1 = 1. Piece 2 area/n = 9/9 = 1.
        // So average area per cell should be constant!
        
        // However, user says "Don't want one big one small".
        // This implies variance is too high.
        // Variance comes from:
        // 1. Polygon shape (long thin strips look smaller).
        // 2. Text sizing logic.
        
        // Let's fix text sizing first.
        // Instead of scaling by area, use a more uniform font size.
        // Calculate average area.
        const avgArea = (width * height) / totalNumbers;
        const baseFontSize = Math.sqrt(avgArea) * 0.4; // Fixed base size based on total area
        
        let polygons = recursiveSplit(initialPoly, totalNumbers);
        
        // If we have > totalNumbers, merge smallest until count matches.
        // Actually, for "Perfect Coverage" and "Equal Size", we should be careful.
        // The recursive split tries to split by area ratio.
        // But randomness in offset makes sizes unequal.
        // To force equal sizes, we should reduce the randomness in split ratio.
        
        // Also, the previous loop for merging was naive and left holes.
        // To fix holes: Instead of splicing, we should MERGE.
        // But merging complex polygons (with arcs) is hard.
        // Better: Ensure we don't over-generate.
        // The recursive split stops when n=1. It generates exactly n polygons if logic is correct.
        // The only reason it would generate > n is if distributeSplit logic is off or rounding errors.
        // Let's rely on recursiveSplit being correct.
        
        // If we do have extra (due to fallback returning [poly] but n>1? No, fallback returns [poly] for n?),
        // Actually if fallback returns [poly], n is still assigned to it.
        // If we failed to split a n=5 poly, we get 1 poly with n=5.
        // We need to handle that.
        // The current recursiveSplit implementation returns [poly] if split fails.
        // If n > 1, this means we have 1 polygon that SHOULD have been 5.
        // This is "Under-generation".
        // The prompt says "Generate Polygons".
        // If we have fewer polygons, we need to split them more.
        
        // Check count
        let iterations = 0;
        
        // Fix for "Missing 1":
        // If polygons.length < totalNumbers, we have fewer cells than numbers.
        // The numbers array has totalNumbers elements.
        // If polygons has N elements, and totalNumbers is M (M > N).
        // The render loop iterates polygons.
        // polygons.forEach((poly, i) => { const num = (i < totalNumbers) ? numbers[i] : null; ... })
        // It only renders polygons.length numbers.
        // So numbers[N] ... numbers[M-1] are dropped.
        // Since numbers are shuffled, ANY number (including 1) could be in the dropped range.
        
        // We MUST ensure polygons.length >= totalNumbers.
        // The loop below tries to split largest polygons to increase count.
        // We should make it more aggressive or fail-safe.
        
        while (polygons.length < totalNumbers && iterations < 100) { // Increased iterations limit
            // Find largest polygon
            let maxArea = -1;
            let maxIdx = -1;
            for(let i=0; i<polygons.length; i++) {
                const area = Math.abs(d3.polygonArea(polygons[i]));
                if (area > maxArea) {
                    maxArea = area;
                    maxIdx = i;
                }
            }
            
            if (maxIdx !== -1) {
                // Split this largest polygon into 2
                const target = polygons[maxIdx];
                // Force a split (n=2)
                const pieces = recursiveSplit(target, 2); 
                if (pieces.length === 2) {
                    polygons.splice(maxIdx, 1, ...pieces);
                } else {
                    // Split failed (maybe too small or weird shape).
                    // Try the SECOND largest?
                    // For now, just continue, but maybe we are stuck.
                    // If we can't split the largest, we are in trouble.
                    // Force a simple line cut through centroid?
                    // recursiveSplit has fallback. If it returns [poly], it failed.
                    
                    // Let's try to force a line cut if recursiveSplit fails.
                    const bounds = getBounds(target);
                    const centroid = d3.polygonCentroid(target);
                    // Vertical or horizontal cut
                    const line = (bounds.width > bounds.height) 
                        ? { x: centroid[0], y: centroid[1], nx: 1, ny: 0 } // Vertical
                        : { x: centroid[0], y: centroid[1], nx: 0, ny: 1 }; // Horizontal
                    
                    const [p1, p2] = cutPolygon(target, line);
                    if (p1 && p2 && p1.length >= 3 && p2.length >= 3) {
                         polygons.splice(maxIdx, 1, p1, p2);
                    } else {
                         // Even forced cut failed? Break to prevent infinite loop
                         break;
                    }
                }
            }
            iterations++;
        }
        
        // Final Safety Check:
        // If we STILL have fewer polygons than numbers, we must truncate the numbers array or (better) reuse polygons?
        // No, reused polygons overlap.
        // If we really can't generate enough polygons, we have to show fewer numbers.
        // But user wants 1-100.
        // This usually happens if area is too small.
        // With 100 numbers on a screen, it should be fine.
        
        // IMPORTANT: If polygons.length < totalNumbers, we are missing numbers.
        // We should at least log it or alert.
        if (polygons.length < totalNumbers) {
            console.error("Failed to generate enough polygons!");
            // Adjust totalNumbers to match available polygons so we don't have "missing" numbers from the set 1..N
            // But wait, the game logic relies on 1..totalNumbers.
            // If we have 99 polygons and we need 100.
            // We should ideally restart generation or force split.
            // But for now, let's just accept we might have fewer cells.
            // AND ensure we take the first N numbers.
            // The shuffled array `numbers` has `totalNumbers` items.
            // If we only render `polygons.length` items, we pick the first `polygons.length` from shuffled array.
            // This means we might drop '1' if '1' is at the end of the shuffled array.
            
            // CORRECT FIX:
            // If we have fewer polygons, we must ensure the numbers 1..polygons.length are used?
            // No, the game target is 1..totalNumbers.
            // If we are missing a cell, we can't finish the game if target reaches that missing number.
            
            // So we MUST update totalNumbers to match actual polygons generated.
            totalNumbers = polygons.length;
            // Update the global totalNumbers logic?
            // Yes, otherwise game breaks.
            console.warn(`Adjusting totalNumbers to ${totalNumbers} due to generation limits.`);
            
            // Also update the input display to reflect reality?
            // totalNumbersInput.value = totalNumbers; // Maybe confusing if it changes.
        }

        // Create a shuffled array of numbers 1-totalNumbers
        const numbers = d3.shuffle(d3.range(1, totalNumbers + 1));
        
        // Render
        cellByNumber.clear();
        textByNumber.clear();
        cellMetadata.clear();

        const cellGroup = svg.append("g").attr("class", "cells");
        noiseGroupSelection = svg.append("g")
            .attr("class", "visual-noise")
            .attr("pointer-events", "none");
        const textGroup = svg.append("g").attr("class", "texts");
        textGroupSelection = textGroup;
        interferenceGroupSelection = svg.append("g")
            .attr("class", "interference")
            .attr("pointer-events", "none");

        polygons.forEach((poly, i) => {
            const num = (i < totalNumbers) ? numbers[i] : null; 
            let textElement = null; // Declare in outer scope
            
            // Centroid
            const centroid = d3.polygonCentroid(poly);

            // Render Path
            const pathElement = cellGroup.append("path")
                .attr("d", "M" + poly.join("L") + "Z")
                .attr("class", "cell-region")
                .attr("data-number", num)
                .attr("fill", "#f9f9f9")
                .attr("stroke", "#333")
                .attr("stroke-width", 1)
                .on("click", function() {
                    if (num !== null) {
                        handleCellClick(num, d3.select(this), d3.select(textElement));
                    }
                });

            if (num !== null) {
                // Render Text
                
                // Use Pole of Inaccessibility for better centering in irregular shapes
                // (Approximate with centroid for now, but ensure it's inside)
                // d3.polygonCentroid is usually inside for convex, but we have cuts.
                // Our cuts result in convex-ish shapes? Circle cuts make them concave.
                // Centroid might be outside!
                // We need a robust "visual center".
                
                // Simple robust center: Average of vertices? Same as centroid.
                // Better: Sample points inside?
                // Or: Compute bounding box center and clamp to poly?
                // Let's stick to Centroid but check if it's inside.
                // d3.polygonContains(polygon, point)
                
                let cx = centroid[0];
                let cy = centroid[1];
                
                if (!d3.polygonContains(poly, centroid)) {
                    // Fallback: Find a point definitely inside.
                    // Just take average of 3 vertices? Or use a vertex?
                    // Safe bet: Average of first 3 points (triangle) is inside if convex.
                    // But concave...
                    // Let's use the first vertex + small offset? No.
                    // Let's just use the bounding box center? No.
                    // Scan line?
                    // Simple hack: Move towards a vertex until inside.
                    // Or just use the first vertex. (Bad visual)
                    
                    // Actually, for this game, just ensure text is readable.
                    // Let's try to find a point inside.
                    // The poly is defined by vertices.
                    // Try (v0 + v1 + v2) / 3 ?
                    // Let's stick to centroid for now, as most shapes are simple.
                }

                // Uniform Font Size
                // Use the pre-calculated baseFontSize
                const fontSize = Math.max(12, Math.min(60, baseFontSize)); 
                
                // No rotation for better readability as requested ("don't want weird things")
                // Or maybe slight rotation is okay? User said "Don't want one big one small".
                // Didn't say "No rotation". But "Control size... Consistent".
                // Let's reduce rotation to be subtle.
                const rotation = (Math.random() - 0.5) * 20; // Reduced from 60 to 20

                // Assign to the variable in outer scope
                textElement = textGroup.append("text")
                    .attr("x", cx)
                    .attr("y", cy)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central")
                    .attr("font-size", fontSize)
                    .attr("transform", `rotate(${rotation}, ${cx}, ${cy})`) // Rotate around CENTER
                    .text(num)
                    .attr("fill", "black") // Explicitly set initial color to black
                    .attr("pointer-events", "none")
                    .node();

                cellByNumber.set(num, pathElement);
                textByNumber.set(num, d3.select(textElement));
                cellMetadata.set(num, {
                    polygon: poly,
                    center: [cx, cy],
                    fontSize,
                    rotation
                });
            }
        });
    }

    function recursiveSplit(poly, n) {
        if (n <= 1) return [poly];

        const centroid = d3.polygonCentroid(poly);
        const angle = Math.random() * Math.PI * 2;
        const bounds = getBounds(poly);
        const span = Math.min(bounds.width, bounds.height);
        
        // Randomly choose between Line Cut (70%) and Circle Cut (30%)
        // Circle cut adds "arcs" to the shapes
        const useCircleCut = Math.random() < 0.3;
        
        // Calculate offset (common for line and circle)
        // Offset ensures the cut passes near the centroid
        // REDUCE OFFSET RANDOMNESS for more equal splits
        const offset = (Math.random() - 0.5) * span * 0.1; // Reduced from 0.3 to 0.1
        
        // Point P on the cut line (perpendicular to normal)
        const px = centroid[0] + Math.cos(angle + Math.PI/2) * offset;
        const py = centroid[1] + Math.sin(angle + Math.PI/2) * offset;

        if (useCircleCut) {
             // Strategy: "Bent Line" Cut
             // Instead of a random circle, we define a circle that passes through P
             // and is tangent to the line defined by (px, py) and normal (angle).
             // This ensures the cut is significant and central, not a tiny secant.
             
             // Radius: Large enough to create a gentle curve (Semicircle-ish)
             // R > Span ensures it's not a small bubble.
             // Randomly curve "left" or "right" relative to the line.
             const curvature = (Math.random() > 0.5 ? 1 : -1);
             const r = span * (0.8 + Math.random() * 1.5); // 0.8x to 2.3x span
             
             // Center C is located along the normal vector from P
             // C = P + curvature * R * Normal
             const nx = Math.cos(angle);
             const ny = Math.sin(angle);
             
             const cx = px + curvature * r * nx;
             const cy = py + curvature * r * ny;
             
             const circle = { cx, cy, r };
             const [poly1, poly2] = cutPolygonWithCircle(poly, circle);
             
             if (poly1 && poly2 && poly1.length >= 3 && poly2.length >= 3) {
                 return distributeSplit(poly1, poly2, n);
             }
             // Fallback to line cut if circle failed
        }
        
        const line = {
            x: px,
            y: py,
            nx: Math.cos(angle),
            ny: Math.sin(angle)
        };

        const [poly1, poly2] = cutPolygon(poly, line);

        if (!poly1 || !poly2 || poly1.length < 3 || poly2.length < 3) {
            // If the initial random line cut failed, try passing through centroid
            if (offset !== 0) {
                 const line2 = { x: centroid[0], y: centroid[1], nx: Math.cos(angle), ny: Math.sin(angle) };
                 const [p1, p2] = cutPolygon(poly, line2);
                 if (p1 && p2 && p1.length >= 3 && p2.length >= 3) {
                     return distributeSplit(p1, p2, n);
                 }
            }
            return [poly];
        }

        return distributeSplit(poly1, poly2, n);
    }

    // --- Circle Cutting Logic ---
    
    function cutPolygonWithCircle(poly, circle) {
        const p1 = []; // Inside
        const p2 = []; // Outside
        
        // Find all intersections first
        // We need to traverse the polygon edges.
        // If an edge intersects the circle, we get intersection points.
        
        // We will build the new polygons by traversing the original vertices
        // and injecting arc points when crossing the boundary.
        
        // Pre-calculate signed distances for vertices
        // dist < 0 : Inside, dist > 0 : Outside
        const dists = poly.map(p => (p[0]-circle.cx)**2 + (p[1]-circle.cy)**2 - circle.r**2);
        
        // If all inside or all outside, return null (no cut)
        const allIn = dists.every(d => d <= 0);
        const allOut = dists.every(d => d >= 0);
        if (allIn || allOut) return [null, null];

        // We need to handle the loop correctly.
        for (let i = 0; i < poly.length; i++) {
            const curr = poly[i];
            const next = poly[(i + 1) % poly.length];
            const dCurr = dists[i];
            const dNext = dists[(i + 1) % poly.length];
            
            // Add current vertex to appropriate list
            if (dCurr <= 0) p1.push(curr); // Inside
            if (dCurr >= 0) p2.push(curr); // Outside
            
            // Check for intersection
            if ((dCurr < 0 && dNext > 0) || (dCurr > 0 && dNext < 0)) {
                // Crossing
                const intersects = getCircleIntersections(curr, next, circle);
                if (intersects.length > 0) {
                    // There should be exactly one intersection on this segment if signs are different
                    // But getCircleIntersections might return 0, 1, or 2.
                    // Given signs are different, it must be 1 (or 2 if tangent? unlikely).
                    // We take the one that is on the segment.
                    
                    const intersect = intersects[0]; // Simplified
                    
                    p1.push(intersect);
                    p2.push(intersect);
                    
                    // Now, we need to inject ARC points.
                    // But we don't know the "next" intersection yet in this loop.
                    // However, we can add a marker or handle it differently.
                    // Alternative: The ARC is the boundary.
                    // The arc connects this intersection to the *next* intersection along the circle.
                    // But which next intersection?
                    // The one that closes the shape.
                    
                    // Actually, simpler approach:
                    // Just collect all vertices + intersections.
                    // Then for p1 (Inside), any segment between two Intersections that was NOT an original edge
                    // must be an Arc.
                    // But wait, p1 has (Intersection) -> (Intersection) immediately?
                    // No, p1 has (Intersection) -> (Next Vertex if Inside) -> ...
                    // If we just exited (Inside -> Outside), p1 has (Intersection).
                    // The next point p1 adds will be the *next* time we enter (Outside -> Inside).
                    // So in p1, we have ... -> I_exit -> I_entry -> ...
                    // The segment I_exit -> I_entry is the gap where we were outside.
                    // This gap should be filled by the Arc.
                    
                    // For p2 (Outside): ... -> I_entry -> I_exit -> ...
                    // The segment I_entry -> I_exit is the gap where we were inside.
                    // This gap should be filled by the Arc.
                }
            }
        }
        
        // Post-process to inject arcs
        injectArcs(p1, circle, true);  // Inside polygon
        injectArcs(p2, circle, false); // Outside polygon
        
        return [p1, p2];
    }
    
    function injectArcs(poly, circle, isInsidePoly) {
        // Iterate through polygon. If distance between two points is significant
        // AND both points are on the circle, check if we need to add arc points.
        
        // However, "on the circle" check is fuzzy.
        // Better: Tag the points in the loop above.
        // But since we didn't tag, let's use geometry.
        
        // If dist(p, center) ~ r, it's on circle.
        const tol = 1.0; // tolerance
        
        // We need to splice into array, so iterate backwards or build new array
        const newPoly = [];
        
        for (let i = 0; i < poly.length; i++) {
            const curr = poly[i];
            const next = poly[(i + 1) % poly.length];
            
            newPoly.push(curr);
            
            // Check if both are on circle
            const d1 = Math.abs(Math.sqrt((curr[0]-circle.cx)**2 + (curr[1]-circle.cy)**2) - circle.r);
            const d2 = Math.abs(Math.sqrt((next[0]-circle.cx)**2 + (next[1]-circle.cy)**2) - circle.r);
            
            if (d1 < tol && d2 < tol) {
                // Both on circle. Is this an arc or a very short chord?
                // Or is it an original edge that happened to be on circle? (Unlikely)
                // It is likely a cut boundary.
                // Generate arc points.
                
                const points = getArcPoints(curr, next, circle, isInsidePoly);
                // Add intermediate points
                for (const p of points) {
                    newPoly.push(p);
                }
            }
        }
        
        // Replace poly content
        poly.length = 0;
        poly.push(...newPoly);
    }
    
    function getArcPoints(p1, p2, circle, isInsidePoly) {
        const points = [];
        const a1 = Math.atan2(p1[1] - circle.cy, p1[0] - circle.cx);
        const a2 = Math.atan2(p2[1] - circle.cy, p2[0] - circle.cx);
        
        let startAngle = a1;
        let endAngle = a2;
        
        // Normalize angles to 0-2PI for calculation?
        // No, atan2 returns -PI to PI.
        
        // There are two arcs: CW and CCW.
        // We need the one that matches the polygon winding?
        // Or simpler: The arc that lies *inside* the original polygon?
        // We don't have the original polygon here easily.
        
        // Heuristic:
        // For "Inside Poly" (Intersection of Poly and Disk), the boundary is the arc of the disk.
        // The arc must be the "short" way? Not necessarily.
        // But typically, a split creates a chord. The arc is the one on the "other side" of the chord?
        // No.
        
        // Let's assume the cut is "simple" (convex poly).
        // The arc points should keep the center of the circle on the correct side?
        // For PolyInside: The polygon is INSIDE the circle.
        // So the boundary is the circle itself.
        // The curvature should face INWARDS.
        // i.e., the center of the circle is on the "inside" of the edge p1->p2?
        // Yes.
        
        // For PolyOutside: The polygon is OUTSIDE the circle.
        // The curvature should face OUTWARDS.
        // i.e., the center is on the "outside" of the edge p1->p2.
        
        // Check midpoint of the two possible arcs.
        // Arc 1: (a1 + a2) / 2
        // Arc 2: (a1 + a2) / 2 + PI
        // Distance to center is R.
        // Check if Midpoint is to the Left or Right of Vector p1->p2.
        // Cross product: (p2.x - p1.x)*(m.y - p1.y) - (p2.y - p1.y)*(m.x - p1.x)
        // If > 0 (Left), if < 0 (Right). (Assuming standard coordinate system, y down? SVG y is down).
        // In SVG (y down):
        // CW is positive angle change? atan2 is standard math (y up usually? No, y is just y).
        // Let's rely on standard logic.
        
        // Angle difference
        let diff = endAngle - startAngle;
        while (diff <= -Math.PI) diff += 2*Math.PI;
        while (diff > Math.PI) diff -= 2*Math.PI;
        
        // diff is the short way.
        // We generate points along this short way.
        // Is it always the short way?
        // If the cut is small (chord), yes.
        // If the cut is massive (keeping only a sliver), the arc might be the long way?
        // But recursiveSplit splits roughly in half. So arc is likely < 180 deg.
        
        // Verification:
        // Midpoint of short arc.
        // If isInsidePoly (Poly is inside Circle): Center is on the "Inside" of the boundary.
        // So Midpoint should be closer to Center than the Chord? Always true.
        // Wait.
        // PolyInside boundary is convex (bulges out).
        // PolyOutside boundary is concave (bulges in).
        
        // Correct Logic:
        // For PolyInside: We want the arc. The region is bounded by the chord and the arc.
        // The polygon area includes the segment between chord and arc?
        // No, PolyInside IS the segment.
        // So we want the arc that goes from p1 to p2.
        
        // Let's just generate the short arc and see.
        // Resolution
        const count = Math.ceil(Math.abs(diff) * circle.r / 5); // 5px segments
        
        for (let k = 1; k < count; k++) {
            const t = k / count;
            const ang = startAngle + diff * t;
            points.push([
                circle.cx + circle.r * Math.cos(ang),
                circle.cy + circle.r * Math.sin(ang)
            ]);
        }
        
        return points;
    }

    function getCircleIntersections(p1, p2, circle) {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const fx = p1[0] - circle.cx;
        const fy = p1[1] - circle.cy;
        
        const a = dx*dx + dy*dy;
        const b = 2*(fx*dx + fy*dy);
        const c = (fx*fx + fy*fy) - circle.r*circle.r;
        
        const delta = b*b - 4*a*c;
        
        if (delta < 0) return [];
        
        const t1 = (-b - Math.sqrt(delta)) / (2*a);
        const t2 = (-b + Math.sqrt(delta)) / (2*a);
        
        const res = [];
        if (t1 >= 0 && t1 <= 1) {
            res.push([p1[0] + t1*dx, p1[1] + t1*dy]);
        }
        if (t2 >= 0 && t2 <= 1) {
            res.push([p1[0] + t2*dx, p1[1] + t2*dy]);
        }
        
        return res;
    }

    function distributeSplit(p1, p2, n) {
        const a1 = Math.abs(d3.polygonArea(p1));
        const a2 = Math.abs(d3.polygonArea(p2));
        const totalArea = a1 + a2;
        
        let n1 = Math.round(n * (a1 / totalArea));
        
        if (n1 < 1) n1 = 1;
        if (n1 > n - 1) n1 = n - 1;
        
        const n2 = n - n1;
        
        return recursiveSplit(p1, n1).concat(recursiveSplit(p2, n2));
    }

    function cutPolygon(poly, line) {
        const c = -(line.nx * line.x + line.ny * line.y);
        
        const p1 = [];
        const p2 = [];
        
        for (let i = 0; i < poly.length; i++) {
            const curr = poly[i];
            const next = poly[(i + 1) % poly.length];
            
            const dCurr = line.nx * curr[0] + line.ny * curr[1] + c;
            const dNext = line.nx * next[0] + line.ny * next[1] + c;
            
            if (dCurr >= 0) p1.push(curr);
            if (dCurr <= 0) p2.push(curr);
            
            if ((dCurr > 0 && dNext < 0) || (dCurr < 0 && dNext > 0)) {
                const t = dCurr / (dCurr - dNext);
                const ix = curr[0] + t * (next[0] - curr[0]);
                const iy = curr[1] + t * (next[1] - curr[1]);
                const intersect = [ix, iy];
                
                p1.push(intersect);
                p2.push(intersect);
            }
        }
        
        return [p1, p2];
    }

    function getBounds(poly) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of poly) {
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[1] > maxY) maxY = p[1];
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    function normalizeRangeValue(value, min, max) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return min;
        return Math.max(min, Math.min(max, Math.round(numeric)));
    }

    function setLoadInputsDisabled(disabled) {
        [distractorStrengthInput, visualNoiseInput, targetSimilarityInput].forEach(input => {
            if (input) input.disabled = disabled;
        });
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function roundTo(value, digits = 2) {
        if (!Number.isFinite(value)) return 0;
        const factor = 10 ** digits;
        return Math.round(value * factor) / factor;
    }

    function readLoadRatio(input, fallback) {
        if (!input) return fallback;
        return normalizeRangeValue(input.value, 0, 100) / 100;
    }

    function estimateLoadLevel({ distractorStrength, visualNoise, targetDistractorSimilarity }) {
        const densityPressure = totalNumbers / 100;
        return clamp(
            Math.round(1 + densityPressure * 2 + distractorStrength * 2 + visualNoise * 1.5 + targetDistractorSimilarity * 1.5),
            1,
            8
        );
    }

    function computeInitialDeadlineMs({ distractorStrength, visualNoise, targetDistractorSimilarity }) {
        const densityCost = Math.sqrt(totalNumbers) * 350;
        const loadCost = ((distractorStrength + visualNoise + targetDistractorSimilarity) / 3) * 1800;
        return clamp(Math.round(3300 + densityCost + loadCost), MIN_DEADLINE_MS, MAX_DEADLINE_MS);
    }

    function getStimulusDensity() {
        const area = layoutBounds.width * layoutBounds.height;
        return {
            totalTargets: totalNumbers,
            targetsPer100kPx: area > 0 ? roundTo(totalNumbers / (area / 100000), 2) : null
        };
    }

    function compactLoadState(state) {
        if (!state) return null;
        const { lastChange, ...rest } = state;
        return { ...rest };
    }

    function snapshotAdaptiveState() {
        if (!adaptiveState) return null;
        const lastChange = adaptiveState.lastChange ? {
            direction: adaptiveState.lastChange.direction,
            reason: adaptiveState.lastChange.reason,
            sourceBlockIndex: adaptiveState.lastChange.sourceBlockIndex ?? null,
            before: compactLoadState(adaptiveState.lastChange.before),
            after: compactLoadState(adaptiveState.lastChange.after)
        } : null;
        return {
            blockIndex: adaptiveState.blockIndex,
            blockSize: adaptiveState.blockSize,
            level: adaptiveState.level,
            targetDensity: adaptiveState.targetDensity,
            distractorStrength: roundTo(adaptiveState.distractorStrength, 3),
            visualNoise: roundTo(adaptiveState.visualNoise, 3),
            targetDistractorSimilarity: roundTo(adaptiveState.targetDistractorSimilarity, 3),
            responseDeadlineMs: adaptiveState.responseDeadlineMs,
            recommendedNextTotalNumbers: adaptiveState.recommendedNextTotalNumbers,
            nextRecommendation: adaptiveState.nextRecommendation,
            lastChange
        };
    }

    function initializeTrainingState() {
        const distractorStrength = readLoadRatio(distractorStrengthInput, 0.45);
        const visualNoise = readLoadRatio(visualNoiseInput, 0.3);
        const targetDistractorSimilarity = readLoadRatio(targetSimilarityInput, 0.45);
        const initialLoad = {
            distractorStrength,
            visualNoise,
            targetDistractorSimilarity
        };

        adaptiveState = {
            blockIndex: 0,
            blockSize: Math.max(1, Math.min(BLOCK_SIZE, totalNumbers)),
            level: estimateLoadLevel(initialLoad),
            targetDensity: { totalTargets: totalNumbers, targetsPer100kPx: null },
            distractorStrength,
            visualNoise,
            targetDistractorSimilarity,
            responseDeadlineMs: computeInitialDeadlineMs(initialLoad),
            recommendedNextTotalNumbers: totalNumbers,
            nextRecommendation: 'collect-baseline',
            lastChange: {
                direction: 'initial',
                reason: 'initial-controls',
                before: null,
                after: null
            }
        };

        blockSummaries = [];
        loadHistory = [{
            ...snapshotAdaptiveState(),
            sourceBlockIndex: null,
            direction: 'initial',
            reason: 'initial-controls'
        }];
        updateTrainingHud();
    }

    function updateTrainingHud() {
        if (focusBlockDisplay) {
            focusBlockDisplay.textContent = String((adaptiveState?.blockIndex || 0) + 1);
        }
        if (focusLoadDisplay) {
            focusLoadDisplay.textContent = `L${adaptiveState?.level || 1}`;
        }
    }

    function clearTargetDeadline() {
        if (targetDeadlineTimer) {
            clearTimeout(targetDeadlineTimer);
            targetDeadlineTimer = null;
        }
    }

    function scheduleTargetDeadline(targetNumber, startedAt) {
        clearTargetDeadline();
        if (!adaptiveState) return;
        const deadlineMs = adaptiveState.responseDeadlineMs;
        targetDeadlineTimer = setTimeout(() => {
            if (!isPlaying || Number(currentTarget) !== Number(targetNumber) || omittedTargets.has(targetNumber)) {
                return;
            }
            const missedAt = Date.now();
            omittedTargets.add(targetNumber);
            recordTrial({
                targetNumber,
                responseNumber: null,
                correct: false,
                respondedAt: missedAt,
                errorType: 'omission',
                eventType: 'deadline',
                updateLastResponse: false,
                forcedRtMs: null,
                targetElapsedOverrideMs: Math.max(0, Math.round(missedAt - startedAt))
            });
        }, deadlineMs);
    }

    function beginTargetTrial(targetNumber, startedAt) {
        targetPresentedAt = startedAt;
        activeTargetCondition = buildTargetCondition(targetNumber);
        targetConditions.set(targetNumber, activeTargetCondition);
        applyTargetInterference(activeTargetCondition);
        scheduleTargetDeadline(targetNumber, startedAt);
        updateTrainingHud();
    }

    function getSimilarityScore(targetNumber, candidateNumber) {
        const targetText = String(targetNumber);
        const candidateText = String(candidateNumber);
        const sharedDigits = [...new Set(targetText)].filter(digit => candidateText.includes(digit)).length;
        const sameDecade = Math.floor(targetNumber / 10) === Math.floor(candidateNumber / 10) ? 1 : 0;
        const sameOnes = targetNumber % 10 === candidateNumber % 10 ? 1 : 0;
        const nearValue = Math.max(0, 1 - Math.min(Math.abs(targetNumber - candidateNumber), 20) / 20);
        return sharedDigits * 2 + sameDecade * 1.5 + sameOnes * 1.2 + nearValue + Math.random() * 0.25;
    }

    function getSimilarDistractors(targetNumber, desiredCount) {
        let candidates = Array.from(cellMetadata.keys())
            .filter(num => num !== targetNumber && !completedTargets.has(num));
        if (candidates.length < desiredCount) {
            candidates = Array.from(cellMetadata.keys()).filter(num => num !== targetNumber);
        }

        return candidates
            .map(num => ({ number: num, score: getSimilarityScore(targetNumber, num) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, desiredCount)
            .map(item => item.number);
    }

    function makeDecoyLabel(targetNumber, distractorNumber) {
        const lookAlikes = {
            '0': ['8', '6'],
            '1': ['7', '4'],
            '2': ['3', '7'],
            '3': ['8', '5'],
            '4': ['1', '7'],
            '5': ['6', '8'],
            '6': ['8', '5'],
            '7': ['1', '4'],
            '8': ['3', '6'],
            '9': ['8', '6']
        };
        const source = String(Math.random() < 0.55 ? targetNumber : distractorNumber);
        const chars = source.split('');
        const index = Math.floor(Math.random() * chars.length);
        const options = lookAlikes[chars[index]] || [chars[index]];
        chars[index] = options[Math.floor(Math.random() * options.length)];
        return chars.join('');
    }

    function buildTargetCondition(targetNumber) {
        const state = adaptiveState || {
            blockIndex: 0,
            distractorStrength: 0,
            visualNoise: 0,
            targetDistractorSimilarity: 0,
            responseDeadlineMs: MAX_DEADLINE_MS
        };
        const rareInterference = Math.random() < clamp(0.08 + state.distractorStrength * 0.22 + state.targetDistractorSimilarity * 0.12, 0.08, 0.42);
        const noiseActive = Math.random() < clamp(0.12 + state.visualNoise * 0.68, 0.12, 0.85);
        const desiredDistractors = clamp(
            Math.round(2 + state.distractorStrength * 7 + state.targetDistractorSimilarity * 7 + (rareInterference ? 4 : 0)),
            1,
            Math.max(1, totalNumbers - 1)
        );
        const distractorNumbers = getSimilarDistractors(targetNumber, desiredDistractors);
        const conditionType = rareInterference && noiseActive
            ? 'combined-interference'
            : rareInterference
                ? 'similar-distractor'
                : noiseActive
                    ? 'visual-noise'
                    : 'baseline';

        return {
            conditionId: `focus-b${state.blockIndex}-t${targetNumber}`,
            conditionType,
            targetNumber,
            blockIndex: state.blockIndex,
            isRareInterference: rareInterference,
            targetDensity: getStimulusDensity(),
            distractorStrength: roundTo(state.distractorStrength, 3),
            visualNoise: roundTo(state.visualNoise, 3),
            targetDistractorSimilarity: roundTo(state.targetDistractorSimilarity, 3),
            responseDeadlineMs: state.responseDeadlineMs,
            similarDistractorCount: distractorNumbers.length,
            distractorNumbers,
            decoyGlyphs: distractorNumbers.map(num => ({
                nearNumber: num,
                label: makeDecoyLabel(targetNumber, num)
            }))
        };
    }

    function resetInterferenceStyles() {
        if (interferenceGroupSelection) interferenceGroupSelection.selectAll("*").remove();

        cellByNumber.forEach((pathSelection, number) => {
            if (pathSelection.classed("found") || pathSelection.classed("latest-found")) return;
            pathSelection
                .attr("fill", "#f9f9f9")
                .attr("stroke", "#333")
                .attr("stroke-width", 1);
        });

        textByNumber.forEach((textSelection, number) => {
            if (textSelection.classed("found") || textSelection.classed("latest-found")) return;
            if (!isAdvancedMode && completedTargets.has(number)) return;
            const metadata = cellMetadata.get(number);
            textSelection
                .attr("fill", "black")
                .attr("font-weight", null)
                .attr("opacity", 1);
            if (metadata) {
                textSelection.attr("font-size", metadata.fontSize);
            }
        });
    }

    function renderVisualNoise(condition) {
        if (!noiseGroupSelection) return;
        noiseGroupSelection.selectAll("*").remove();
        const width = layoutBounds.width;
        const height = layoutBounds.height;
        const intensity = clamp(condition.visualNoise + condition.distractorStrength * 0.25, 0, 1);
        const noiseCount = Math.round(intensity * 70 + (condition.isRareInterference ? 14 : 0));

        for (let i = 0; i < noiseCount; i++) {
            if (Math.random() < 0.55) {
                const x1 = Math.random() * width;
                const y1 = Math.random() * height;
                const angle = Math.random() * Math.PI * 2;
                const length = 8 + Math.random() * 26;
                noiseGroupSelection.append("line")
                    .attr("x1", x1)
                    .attr("y1", y1)
                    .attr("x2", x1 + Math.cos(angle) * length)
                    .attr("y2", y1 + Math.sin(angle) * length)
                    .attr("stroke", condition.isRareInterference ? "#8a6f4d" : "#777")
                    .attr("stroke-width", 0.6 + intensity * 0.9)
                    .attr("opacity", 0.06 + intensity * 0.13);
            } else {
                noiseGroupSelection.append("circle")
                    .attr("cx", Math.random() * width)
                    .attr("cy", Math.random() * height)
                    .attr("r", 1 + Math.random() * (1 + intensity * 3))
                    .attr("fill", "#555")
                    .attr("opacity", 0.05 + intensity * 0.12);
            }
        }
    }

    function renderDecoyGlyphs(condition) {
        if (!interferenceGroupSelection) return;
        const opacity = condition.isRareInterference ? 0.56 : 0.36;
        const maxGlyphs = clamp(Math.round(3 + condition.distractorStrength * 9), 1, condition.decoyGlyphs.length);
        condition.decoyGlyphs.slice(0, maxGlyphs).forEach((glyph, index) => {
            const metadata = cellMetadata.get(glyph.nearNumber);
            if (!metadata) return;
            const angle = (index / Math.max(1, maxGlyphs)) * Math.PI * 2 + Math.random() * 0.7;
            const radius = 10 + Math.random() * 16;
            const x = metadata.center[0] + Math.cos(angle) * radius;
            const y = metadata.center[1] + Math.sin(angle) * radius;
            interferenceGroupSelection.append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("font-size", Math.max(10, metadata.fontSize * 0.58))
                .attr("font-weight", condition.isRareInterference ? 700 : 600)
                .attr("fill", condition.isRareInterference ? "#9a3f2e" : "#666")
                .attr("opacity", opacity)
                .attr("transform", `rotate(${(Math.random() - 0.5) * 42}, ${x}, ${y})`)
                .text(glyph.label);
        });
    }

    function applyTargetInterference(condition) {
        resetInterferenceStyles();
        renderVisualNoise(condition);

        const strokeColor = condition.isRareInterference ? "#9a3f2e" : "#6f6f6f";
        const textColor = condition.isRareInterference ? "#9a3f2e" : "#565656";
        condition.distractorNumbers.forEach(number => {
            if (completedTargets.has(number)) return;
            const textSelection = textByNumber.get(number);
            const pathSelection = cellByNumber.get(number);
            const metadata = cellMetadata.get(number);
            if (pathSelection && !pathSelection.classed("found") && !pathSelection.classed("latest-found")) {
                pathSelection
                    .attr("stroke", strokeColor)
                    .attr("stroke-width", 1 + condition.distractorStrength * 1.6);
            }
            if (textSelection && !textSelection.classed("found") && !textSelection.classed("latest-found")) {
                textSelection
                    .attr("fill", textColor)
                    .attr("font-weight", condition.isRareInterference ? 700 : 600)
                    .attr("opacity", 0.82 + condition.distractorStrength * 0.18);
                if (metadata) {
                    textSelection.attr("font-size", metadata.fontSize * (1 + condition.targetDistractorSimilarity * 0.08));
                }
            }
        });

        renderDecoyGlyphs(condition);
    }

    function standardDeviation(values) {
        if (values.length < 2) return 0;
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
        return Math.round(Math.sqrt(variance));
    }

    function summarizeBlock(blockIndex) {
        const blockSize = adaptiveState?.blockSize || BLOCK_SIZE;
        const targetRangeStart = blockIndex * blockSize + 1;
        const targetRangeEnd = Math.min(totalNumbers, (blockIndex + 1) * blockSize);
        const scheduledTargets = Math.max(0, targetRangeEnd - targetRangeStart + 1);
        const blockTrials = trials.filter(trial => trial.blockIndex === blockIndex);
        const correctClicks = blockTrials.filter(trial => trial.correct && trial.eventType === 'click');
        const falseAlarms = blockTrials.filter(trial => trial.errorType === 'falseAlarm');
        const omissions = blockTrials.filter(trial => trial.errorType === 'omission');
        const denominator = correctClicks.length + falseAlarms.length + omissions.length;
        const rtValues = correctClicks.map(trial => trial.targetElapsedMs).filter(Number.isFinite);
        const firstHalf = rtValues.slice(0, Math.ceil(rtValues.length / 2));
        const secondHalf = rtValues.slice(Math.ceil(rtValues.length / 2));
        const firstHalfMeanRtMs = mean(firstHalf);
        const secondHalfMeanRtMs = mean(secondHalf);
        const vigilanceDeclineMs = secondHalf.length && firstHalf.length ? secondHalfMeanRtMs - firstHalfMeanRtMs : 0;

        return {
            blockIndex,
            targetRangeStart,
            targetRangeEnd,
            scheduledTargets,
            totalEvents: blockTrials.length,
            completedTargets: correctClicks.length,
            falseAlarms: falseAlarms.length,
            omissions: omissions.length,
            accuracy: denominator > 0 ? roundTo(correctClicks.length / denominator, 3) : 0,
            falseAlarmRate: denominator > 0 ? roundTo(falseAlarms.length / denominator, 3) : 0,
            omissionRate: scheduledTargets > 0 ? roundTo(omissions.length / scheduledTargets, 3) : 0,
            meanRtMs: mean(rtValues),
            rtStdDevMs: standardDeviation(rtValues),
            rtCoefficientOfVariation: mean(rtValues) > 0 ? roundTo(standardDeviation(rtValues) / mean(rtValues), 3) : 0,
            firstHalfMeanRtMs,
            secondHalfMeanRtMs,
            vigilanceDeclineMs,
            vigilanceDeclineRatio: firstHalfMeanRtMs > 0 ? roundTo(vigilanceDeclineMs / firstHalfMeanRtMs, 3) : 0
        };
    }

    function chooseLoadAdjustment(summary) {
        const reasons = [];
        if (summary.omissionRate > 0.12) reasons.push('omissions');
        if (summary.falseAlarmRate > 0.18) reasons.push('false-alarms');
        if (summary.rtCoefficientOfVariation > 0.55) reasons.push('rt-variability');
        if (summary.vigilanceDeclineRatio > 0.3) reasons.push('vigilance-decline');

        if (reasons.length) {
            return {
                direction: 'decrease',
                reason: reasons.join('+'),
                nextRecommendation: 'reduce-load-and-stabilize-target-maintenance'
            };
        }

        if (
            summary.accuracy >= 0.92 &&
            summary.omissionRate <= 0.05 &&
            summary.falseAlarmRate <= 0.08 &&
            summary.rtCoefficientOfVariation <= 0.38 &&
            summary.vigilanceDeclineRatio <= 0.15
        ) {
            return {
                direction: 'increase',
                reason: 'stable-high-accuracy-low-variability',
                nextRecommendation: 'increase-similarity-noise-or-target-density'
            };
        }

        return {
            direction: 'maintain',
            reason: 'mixed-performance',
            nextRecommendation: 'maintain-load-until-rt-and-errors-stabilize'
        };
    }

    function applyLoadAdjustment(adjustment, blockIndex, isFinal) {
        const before = snapshotAdaptiveState();
        if (!adaptiveState) return { before: null, after: null };

        if (adjustment.direction === 'increase') {
            adaptiveState.distractorStrength = clamp(adaptiveState.distractorStrength + 0.08, 0, 1);
            adaptiveState.visualNoise = clamp(adaptiveState.visualNoise + 0.06, 0, 1);
            adaptiveState.targetDistractorSimilarity = clamp(adaptiveState.targetDistractorSimilarity + 0.07, 0, 1);
            adaptiveState.responseDeadlineMs = clamp(Math.round(adaptiveState.responseDeadlineMs * 0.92), MIN_DEADLINE_MS, MAX_DEADLINE_MS);
            adaptiveState.recommendedNextTotalNumbers = clamp(totalNumbers + 8, 1, 100);
        } else if (adjustment.direction === 'decrease') {
            adaptiveState.distractorStrength = clamp(adaptiveState.distractorStrength - 0.1, 0, 1);
            adaptiveState.visualNoise = clamp(adaptiveState.visualNoise - 0.08, 0, 1);
            adaptiveState.targetDistractorSimilarity = clamp(adaptiveState.targetDistractorSimilarity - 0.08, 0, 1);
            adaptiveState.responseDeadlineMs = clamp(Math.round(adaptiveState.responseDeadlineMs * 1.14), MIN_DEADLINE_MS, MAX_DEADLINE_MS);
            adaptiveState.recommendedNextTotalNumbers = clamp(totalNumbers - 8, 1, 100);
        } else {
            adaptiveState.recommendedNextTotalNumbers = totalNumbers;
        }

        adaptiveState.blockIndex = isFinal ? adaptiveState.blockIndex : adaptiveState.blockIndex + 1;
        adaptiveState.targetDensity = getStimulusDensity();
        adaptiveState.level = estimateLoadLevel(adaptiveState);
        adaptiveState.nextRecommendation = adjustment.nextRecommendation;
        adaptiveState.lastChange = {
            direction: adjustment.direction,
            reason: adjustment.reason,
            sourceBlockIndex: blockIndex,
            before,
            after: null
        };
        const after = snapshotAdaptiveState();
        adaptiveState.lastChange.after = compactLoadState(after);
        const finalAfter = snapshotAdaptiveState();
        loadHistory.push({
            ...finalAfter,
            sourceBlockIndex: blockIndex,
            direction: adjustment.direction,
            reason: adjustment.reason
        });
        updateTrainingHud();
        return { before, after: finalAfter };
    }

    function finalizeCurrentBlock(isFinal = false) {
        if (!adaptiveState) return;
        const blockIndex = adaptiveState.blockIndex;
        if (blockSummaries.some(summary => summary.blockIndex === blockIndex && summary.closed)) return;

        const summary = summarizeBlock(blockIndex);
        const adjustment = chooseLoadAdjustment(summary);
        const loadChange = applyLoadAdjustment(adjustment, blockIndex, isFinal);
        blockSummaries.push({
            ...summary,
            closed: true,
            isFinal,
            adjustment,
            loadBefore: loadChange.before,
            loadAfter: loadChange.after
        });
    }

    function maybeFinalizeBlock(completedTargetNumber) {
        const blockSize = adaptiveState?.blockSize || BLOCK_SIZE;
        if (completedTargetNumber > 0 && completedTargetNumber % blockSize === 0) {
            finalizeCurrentBlock(false);
        }
    }

    function getModeId() {
        return isAdvancedMode ? 'advanced' : 'simple';
    }

    function mean(values) {
        if (!values.length) return 0;
        return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }

    function recordTrial({
        targetNumber,
        responseNumber,
        correct,
        respondedAt,
        errorType = 'none',
        eventType = 'click',
        updateLastResponse = true,
        forcedRtMs,
        targetElapsedOverrideMs
    }) {
        const responseBaseline = lastResponseAt || targetPresentedAt || startTime || respondedAt;
        const targetBaseline = targetPresentedAt || startTime || respondedAt;
        const condition = targetConditions.get(targetNumber) || activeTargetCondition || buildTargetCondition(targetNumber);
        const targetElapsedMs = Number.isFinite(targetElapsedOverrideMs)
            ? targetElapsedOverrideMs
            : Math.max(0, Math.round(respondedAt - targetBaseline));
        const rtMs = forcedRtMs !== undefined
            ? forcedRtMs
            : Math.max(0, Math.round(respondedAt - responseBaseline));
        const adaptiveSnapshot = snapshotAdaptiveState();

        trials.push({
            index: trials.length,
            trialId: `focus-${trials.length + 1}`,
            eventType,
            stimulus: {
                type: 'number-cell-search',
                targetNumber,
                totalNumbers,
                mode: getModeId(),
                conditionType: condition.conditionType,
                isRareInterference: condition.isRareInterference,
                targetDensity: condition.targetDensity,
                responseDeadlineMs: condition.responseDeadlineMs,
                distractorCondition: {
                    strength: condition.distractorStrength,
                    visualNoise: condition.visualNoise,
                    targetDistractorSimilarity: condition.targetDistractorSimilarity,
                    similarDistractorCount: condition.similarDistractorCount,
                    distractorNumbers: [...condition.distractorNumbers],
                    decoyGlyphCount: condition.decoyGlyphs.length
                }
            },
            target: targetNumber,
            response: responseNumber,
            correct,
            errorType,
            rtMs,
            targetElapsedMs,
            elapsedMs: Math.max(0, Math.round(respondedAt - (startTime || respondedAt))),
            blockIndex: adaptiveSnapshot?.blockIndex || 0,
            adaptiveState: adaptiveSnapshot,
            loadChange: adaptiveSnapshot?.lastChange || null,
            nextRecommendation: adaptiveSnapshot?.nextRecommendation || null
        });

        if (updateLastResponse) {
            lastResponseAt = respondedAt;
        }
    }

    function handleCellClick(num, pathSelection, textSelection) {
        // Ensure numeric types
        const clickNum = Number(num);
        const currentTgt = Number(currentTarget);
        const total = Number(totalNumbers);

        if (!isPlaying) return;

        const respondedAt = Date.now();
        const isCorrect = clickNum === currentTgt;
        recordTrial({
            targetNumber: currentTgt,
            responseNumber: clickNum,
            correct: isCorrect,
            respondedAt,
            errorType: isCorrect
                ? (omittedTargets.has(currentTgt) ? 'omissionRecovery' : 'none')
                : 'falseAlarm',
            eventType: 'click'
        });

        if (isCorrect) {
            clearTargetDeadline();
            completedTargets.add(clickNum);
            // Correct
            if (!isAdvancedMode) {
                // Simple Mode: Gray out background and text
                pathSelection
                    .transition().duration(200)
                    .attr("fill", "#ddd")
                    .attr("class", "cell-region found");
                
                textSelection
                    .classed("found", true)
                    .transition().duration(200)
                    .attr("fill", "#aaa");
            } else {
                // Advanced Mode:
                // Requirement: "当前已经点选到的最大的数字，会保持灰色。"
                // AND "like the simple mode gray" (gray background + gray text).
                
                // 1. Reset PREVIOUSLY found elements (both text and path) to normal.
                
                // Reset Text
                d3.selectAll("text.latest-found")
                    .classed("latest-found", false)
                    .transition().duration(200)
                    .attr("fill", "black");
                
                // Reset Path (Background)
                d3.selectAll("path.latest-found")
                    .classed("latest-found", false)
                    .classed("found", false)
                    .transition().duration(200)
                    .attr("fill", "#f9f9f9");
                
                // 2. Set CURRENT found elements to Gray (Background + Text)
                textSelection
                    .classed("latest-found", true)
                    .transition().duration(200)
                    .attr("fill", "#aaa");
                
                pathSelection
                    .classed("latest-found", true)
                    .classed("found", true)
                    .transition().duration(200)
                    .attr("fill", "#ddd");
            }

            if (clickNum === total) {
                endGame();
            } else {
                maybeFinalizeBlock(clickNum);
                currentTarget++;
                targetDisplay.textContent = currentTarget;
                beginTargetTrial(currentTarget, respondedAt);
            }
        } else {
            // Wrong
            if (!isAdvancedMode) {
                pathSelection
                    .transition().duration(100)
                    .attr("fill", "#ffcccc")
                    .transition().duration(300)
                    .attr("fill", "#f9f9f9");
            }
        }
    }

    function saveTrainingSession({ finishedAt, durationMs, timeStr, grade, equivalentMinutes, scaleFactor }) {
        if (sessionSaved || !window.TrainingResults || typeof window.TrainingResults.saveSession !== 'function') {
            return;
        }

        sessionSaved = true;

        const totalTrials = trials.length;
        const responseTrials = trials.filter(trial => trial.eventType === 'click');
        const correctTrials = responseTrials.filter(trial => trial.correct);
        const correctCount = correctTrials.length;
        const falseAlarmCount = trials.filter(trial => trial.errorType === 'falseAlarm').length;
        const omissionCount = trials.filter(trial => trial.errorType === 'omission').length;
        const omissionRecoveryCount = trials.filter(trial => trial.errorType === 'omissionRecovery').length;
        const errorCount = falseAlarmCount + omissionCount;
        const scoredEvents = correctCount + errorCount;
        const accuracy = scoredEvents > 0 ? correctCount / scoredEvents : 0;
        const correctTargetElapsed = correctTrials.map(trial => trial.targetElapsedMs).filter(Number.isFinite);
        const meanRtMs = mean(correctTargetElapsed);
        const rtStdDevMs = standardDeviation(correctTargetElapsed);
        const rtCoefficientOfVariation = meanRtMs > 0 ? roundTo(rtStdDevMs / meanRtMs, 3) : 0;
        const meanCorrectTargetMs = mean(correctTargetElapsed);
        const numbersPerMinute = durationMs > 0 ? Number((correctCount / (durationMs / 60000)).toFixed(2)) : 0;
        const firstHalfRt = correctTargetElapsed.slice(0, Math.ceil(correctTargetElapsed.length / 2));
        const secondHalfRt = correctTargetElapsed.slice(Math.ceil(correctTargetElapsed.length / 2));
        const firstHalfMeanRtMs = mean(firstHalfRt);
        const secondHalfMeanRtMs = mean(secondHalfRt);
        const vigilanceDeclineMs = firstHalfMeanRtMs > 0 && secondHalfMeanRtMs > 0
            ? secondHalfMeanRtMs - firstHalfMeanRtMs
            : 0;
        const vigilanceDeclineRatio = firstHalfMeanRtMs > 0 ? roundTo(vigilanceDeclineMs / firstHalfMeanRtMs, 3) : 0;
        const finalAdaptiveState = snapshotAdaptiveState();
        const nextRoundSuggestion = {
            recommendation: finalAdaptiveState?.nextRecommendation || 'maintain-load',
            totalNumbers: finalAdaptiveState?.recommendedNextTotalNumbers || totalNumbers,
            distractorStrength: finalAdaptiveState?.distractorStrength ?? readLoadRatio(distractorStrengthInput, 0.45),
            visualNoise: finalAdaptiveState?.visualNoise ?? readLoadRatio(visualNoiseInput, 0.3),
            targetDistractorSimilarity: finalAdaptiveState?.targetDistractorSimilarity ?? readLoadRatio(targetSimilarityInput, 0.45)
        };

        window.TrainingResults.saveSession({
            moduleId: 'focus',
            gameId: 'focus',
            gameName: '注意力集中训练',
            startedAt: sessionStartedAt || new Date(finishedAt.getTime() - durationMs),
            finishedAt,
            durationMs,
            score: Math.round(accuracy * 100),
            summary: {
                totalTrials,
                correctCount,
                accuracy,
                meanRtMs,
                rtStdDevMs,
                rtCoefficientOfVariation,
                errorCount,
                falseAlarmCount,
                omissionCount,
                omissionRecoveryCount,
                totalNumbers,
                mode: getModeId(),
                durationMs,
                elapsedSeconds: Math.round(durationMs / 1000),
                grade,
                equivalentMinutes: Number(equivalentMinutes.toFixed(2)),
                scaleFactor: Number(scaleFactor.toFixed(4)),
                meanCorrectTargetMs,
                numbersPerMinute,
                firstHalfMeanRtMs,
                secondHalfMeanRtMs,
                vigilanceDeclineMs,
                vigilanceDeclineRatio,
                adaptiveState: finalAdaptiveState,
                loadHistory: loadHistory.map(item => ({ ...item })),
                blockSummaries: blockSummaries.map(summary => ({ ...summary })),
                nextRoundSuggestion
            },
            trials: trials.map(trial => ({ ...trial })),
            metrics: {
                accuracy: `${Math.round(accuracy * 100)}%`,
                meanRT: `${meanRtMs}ms`,
                rtVariability: `${rtStdDevMs}ms`,
                omissions: String(omissionCount),
                falseAlarms: String(falseAlarmCount),
                duration: timeStr,
                grade,
                adaptiveLoad: `L${finalAdaptiveState?.level || 1}`,
                mode: isAdvancedMode ? '高级版' : '简单版'
            },
            tags: ['attention', 'focus']
        });
    }

    function endGame() {
        isPlaying = false;
        clearInterval(timerInterval);
        clearTargetDeadline();
        finalizeCurrentBlock(true);
        
        const finishedAt = new Date();
        const durationMs = Math.max(0, finishedAt.getTime() - startTime);
        const elapsedSeconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeStr = `${minutes}分${seconds}秒`;
        
        let grade = "";
        const elapsedMinutes = elapsedSeconds / 60;
        
        // Scale factor: If standard is 100, and user plays N, 
        // the complexity scales roughly with N^2 due to visual search density.
        // So, StandardTime = ActualTime * (100/N)^2
        // This converts current performance to a "100-number equivalent" using a quadratic model.
        
        const scaleFactor = Math.pow(100 / totalNumbers, 2);
        const equivalentMinutes = elapsedMinutes * scaleFactor;

        if (equivalentMinutes < 15) grade = "优 (Excellent)";
        else if (equivalentMinutes < 20) grade = "较好 (Good)";
        else if (equivalentMinutes < 25) grade = "一般 (Average)";
        else if (equivalentMinutes < 30) grade = "及格 (Pass)";
        else grade = "差 (Poor)";
        
        if (totalNumbers !== 100) {
            grade += ` (Scaled)`;
        }

        finalTimeDisplay.textContent = timeStr;
        finalGradeDisplay.textContent = grade;
        saveTrainingSession({ finishedAt, durationMs, timeStr, grade, equivalentMinutes, scaleFactor });
        
        // Ensure modal exists and remove hidden class
        if (resultModal) {
            resultModal.classList.remove('hidden');
        } else {
            console.error("resultModal not found!");
            alert(`挑战成功！\n用时: ${timeStr}\n评级: ${grade}`);
        }
        
        startBtn.disabled = false;
        startBtn.textContent = "开始测试";
        totalNumbersInput.disabled = false;
        setLoadInputsDisabled(false);
    }
});
