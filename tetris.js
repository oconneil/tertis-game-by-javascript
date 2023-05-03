/**
 * Tetris game
 * Written by Marcel Gerber in 2014
 */

(function () {
    "use strict";

    var ORIG_SPEED = 800;
    var EXP_A = 0.846;
    var FASTSPEED_FACTOR = 7;
    var SPEED, FASTSPEED;
    var GRIDSIZE = 20;
    var GAMESIZE_X = 200;
    var SIZE_X = 300;
    var GAMESIZE_Y = 400;
    var SIZE_Y = GAMESIZE_Y;
    var START_X = 80;
    var START_Y = 0;
    var BLOCK_SPACING = 1;


    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");

    var requestAnimFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame,
        cancelAnimFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame;

    var currentObj, currentOrigObj, currentOrientation, currentTimeout,
        nextObj, nextOrigObj, nextOrientation,
        i, j,
        domElements = {},
        cScore = 0, aScore = 0,
        cLevel = 0, aLevel = 0,
        deletedLines = 0,
        points = 0,
        level = 0,
        isFast = false,
        isGameOver = false,
        currentPos = [],
        grid = [],
        lastKeys = "", domi;

    var objects = [
        {color: "#5ce5ff", rows: [[true, true, true, true]]}, // I
        {color: "#3614db", rows: [[true], [true, true, true]]}, // J
        {color: "#fec039", rows: [[true, true, true], [true]]}, // L
        {color: "#fef539", rows: [[true, true], [true, true]]}, // O
        {color: "#62fe39", rows: [[false, true, true], [true, true]]}, // S
        {color: "#f500c5", rows: [[false, true], [true, true, true]]}, // T
        {color: "#f5000b", rows: [[true, true], [false, true, true]]} // Z
    ];

    function rand(min, max) {
        min = min || 0;
        max = max || 1;
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function arrMax(arr) {
        return Math.max.apply(null, arr);
    }

    function randomObject() {
        // clone object
        return clone(objects[rand(0, objects.length - 1)]);
    }

    function pxToGrid(x, y) {
        return [x / GRIDSIZE, y / GRIDSIZE];
    }

    function gridToPx(x, y) {
        return [x * GRIDSIZE, y * GRIDSIZE];
    }

    function clear() {
        ctx.clearRect(0, 0, SIZE_X, SIZE_Y);
    }

    function saturateColor(hexCode, sat) {
        function toRgb(hexCode) {
            var parts = hexCode.split("");
            return {
                r: parseInt(parts[1] + parts[2], 16),
                g: parseInt(parts[3] + parts[4], 16),
                b: parseInt(parts[5] + parts[6], 16)
            };
        }

        function toHex(rgbObj) {
            function comp(rgbNum) {
                var hexString = rgbNum.toString(16);
                return hexString.length === 1 ? "0" + hexString : hexString;
            }
            return "#" + comp(rgbObj.r) + comp(rgbObj.g) + comp(rgbObj.b);
        }

        var rgbObj  = toRgb(hexCode),
            satGray = (rgbObj.r * 0.41 + rgbObj.g * 0.51 + rgbObj.b * 0.08) * (1 - sat);

        rgbObj.r = Math.round(rgbObj.r * sat + satGray);
        rgbObj.g = Math.round(rgbObj.g * sat + satGray);
        rgbObj.b = Math.round(rgbObj.b * sat + satGray);

        return toHex(rgbObj);
    }

    function rotateObject(obj, orientation) {
        obj = clone(obj);

        var row, i, j, ml,
            rows = obj.rows,
            newRows = [];

        function maxLength(rows) {
            var lengths = rows.map(function (arr) {
                return arr.length;
            });
            return arrMax(lengths);
        }

        switch (orientation) {
        case 1:
            ml = maxLength(rows);
            for (i = 0; i < rows.length; i++) {
                row = rows[i];
                for (j = 0; j < ml; j++) {
                    if (!newRows[j]) {
                        newRows[j] = [];
                    }
                    newRows[j][rows.length - i - 1] = row[j] || false;
                }
            }
            ml = maxLength(newRows);
            for (i = 0; i < newRows.length; i++) {
                for (j = ml - 1; j > 0; j--) {
                    if (!newRows[i][j]) {
                        newRows[i].pop();
                    } else {
                        break;
                    }
                }
            }
            break;
        case 2:
            newRows = rows;
            ml = maxLength(newRows);
            newRows.reverse();
            for (i = 0; i < newRows.length; i++) {
                while (newRows[i].length < ml) {
                    newRows[i].push(false);
                }
                newRows[i].reverse();
                for (j = ml - 1; j > 0; j--) {
                    if (!newRows[i][j]) {
                        newRows[i].pop();
                    } else {
                        break;
                    }
                }
            }
            break;
        case 3:
            newRows = rotateObject(rotateObject(obj, 1), 2).rows;
            break;
        default:
            newRows = rows;
        }
        obj.rows = newRows;
        return obj;
    }

    function objDimensions(obj, pos) {
        pos = pos || [0, 0];
        var rows    = obj.rows,
            h       = rows.length,
            w       = arrMax(rows.map(function (row) {
                return row.length;
            })),
            realH   = h * GRIDSIZE,
            realW   = w * GRIDSIZE;

        return {
            height: h,
            width: w,
            realHeight: realH,
            realWidth: realW,
            x0: pos[0],
            x1: pos[0] + realW,
            y0: pos[1],
            y1: pos[1] + realH
        };
    }

    function drawBlockAt(pos, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(pos[0] + BLOCK_SPACING, pos[1] + BLOCK_SPACING);
        ctx.lineTo(pos[0] + GRIDSIZE - BLOCK_SPACING, pos[1] + BLOCK_SPACING);
        ctx.lineTo(pos[0] + GRIDSIZE - BLOCK_SPACING, pos[1] + GRIDSIZE - BLOCK_SPACING);
        ctx.lineTo(pos[0] + BLOCK_SPACING, pos[1] + GRIDSIZE - BLOCK_SPACING);
        ctx.closePath();
        ctx.fill();
    }

    function drawObject(obj, pos) {
        var row, i, j,
            rows = obj.rows;

        /*
        ctx.fillStyle = color;
        ctx.beginPath();
        for (i = 0; i < rows.length; i++) {
            ctx.moveTo(x, y);
            row = rows[i];
            beginningX = x;
            for (j = 0; j < row.length; j++) {
                x += GRIDSIZE;
                if (!row[j]) {
                    ctx.moveTo(x, y);
                    beginningX = x;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            y += GRIDSIZE;
            ctx.lineTo(x, y);
            x = pos[0];
            ctx.lineTo(beginningX, y);
            ctx.closePath();
            ctx.fill();
        }
        */

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            for (j = 0; j < row.length; j++) {
                if (row[j]) {
                    drawBlockAt([pos[0] + j * GRIDSIZE, pos[1] + i * GRIDSIZE], obj.color);
                }
            }
        }
    }

    function drawGrid() {
        var x, y;
        ctx.strokeStyle = "#9b9b9b";
        /*
        for (y = 0; y < GAMESIZE_Y; y += GRIDSIZE) {
            for (x = 0; x < GAMESIZE_X; x += GRIDSIZE) {
                ctx.strokeRect(x, y, GRIDSIZE, GRIDSIZE);
            }
        }
        */
        for (x = 0; x <= GAMESIZE_X; x += GRIDSIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, GAMESIZE_Y);
            ctx.stroke();
        }
        for (y = 0; y <= GAMESIZE_Y; y += GRIDSIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(GAMESIZE_X, y);
            ctx.stroke();
        }
    }

    function drawGridBlocks() {
        var i, j, col, color;
        for (i = 0; i < grid.length; i++) {
            col = grid[i];
            for (j = 0; j < col.length; j++) {
                color = col[j];
                if (color) {
                    drawBlockAt(gridToPx(i, j), color);
                }
            }
        }
    }

    function drawText() {
        var avaibleWidth = SIZE_X - GAMESIZE_X,
            nextDim = objDimensions(nextObj);

        drawObject(nextObj, [GAMESIZE_X + (avaibleWidth - nextDim.realWidth) / 2, 20 + (4 * GRIDSIZE - nextDim.realHeight) / 2]); // show next object

        ctx.strokeStyle = "#9b9b9b";
        ctx.beginPath();
        ctx.moveTo(GAMESIZE_X + 9, 19);
        ctx.lineTo(GAMESIZE_X + 9 + 4 * GRIDSIZE, 19);
        ctx.lineTo(GAMESIZE_X + 9 + 4 * GRIDSIZE, 21 + 4 * GRIDSIZE);
        ctx.lineTo(GAMESIZE_X + 9, 21 + 4 * GRIDSIZE);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = "#111111";
        ctx.font = "15px sans-serif";
        ctx.fillText("Score:", GAMESIZE_X + 2, 130);
        ctx.fillText(points, GAMESIZE_X + 2, 150);
        ctx.fillText("Lines:", GAMESIZE_X + 2, 190);
        ctx.fillText(deletedLines, GAMESIZE_X + 2, 210);
        ctx.fillText("Level:", GAMESIZE_X + 2, 240);
        ctx.fillText(level, GAMESIZE_X + 2, 260);
    }

    function updateLevelAndSpeed() {
        level = Math.min(Math.floor(deletedLines / 10), 19);
        SPEED = ORIG_SPEED * Math.pow(EXP_A, level);
        FASTSPEED = SPEED / FASTSPEED_FACTOR;
    }

    function beforeSpawn() {
        var i, j, k, del,
            oldDeletedLines = deletedLines,
            linesPoints = [0, 40, 100, 300, 1200];
        for (i = 0; i < GAMESIZE_Y / GRIDSIZE; i++) {
            del = true;
            for (j = 0; j < grid.length; j++) {
                if (!grid[j][i]) {
                    del = false;
                    break;
                }
            }
            if (del) {
                for (j = 0; j < grid.length; j++) {
                    grid[j][i] = null;
                    for (k = i; k >= 0; k--) {
                        grid[j][k] = grid[j][k - 1] || null;
                    }
                }
                deletedLines++;
            }
        }
        points += pxToGrid(currentPos[0], currentPos[1])[1]; // points for lines fallen
        points += linesPoints[deletedLines - oldDeletedLines] * (level + 1); // points for line-destroying

        updateLevelAndSpeed();
    }

    function updateHighscores() {
        if (domi) {
            return;
        }

        if (!aScore || !aLevel) {
            aScore = localStorage.hScore || 0;
            aLevel = localStorage.hLevel || 0;
        }

        if (points > cScore) {
            cScore = points;
            cLevel = level;
        }

        if (points > aScore) {
            aScore = points;
            aLevel = level;
        }

        if (aScore !== localStorage.hScore || aLevel !== localStorage.hLevel) {
            localStorage.hScore = aScore;
            localStorage.hLevel = aLevel;
        }

        domElements["c-score"].innerHTML = cScore + " in level " + cLevel;
        domElements["a-score"].innerHTML = aScore + " in level " + aLevel;
    }

    function isBlocked(obj, pos) {
        pos = clone(pos);
        var i, j, row, posBelow,
            gridCoords = pxToGrid(pos[0], pos[1]),
            rows = obj.rows;
        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            for (j = 0; j < row.length; j++) {
                if (row[j]) {
                    posBelow = [gridCoords[0] + j, gridCoords[1] + i];
                    if (grid[posBelow[0]][posBelow[1]]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function render() {
        if (isGameOver) {
            return;
        }

        clear();
        drawGrid();
        drawGridBlocks();
        drawObject(currentObj, currentPos);
        drawText();

        requestAnimFrame(render);
    }

    function gameOver() {
        isGameOver = true;
        cancelAnimFrame(render);
        domElements.gameover.style.display = "block";
    }

    function spawn() {
        var nextObjExists = !!nextObj;
        if (nextObjExists) {
            currentOrigObj = nextOrigObj;
            currentOrientation = nextOrientation;
            currentObj = nextObj;
            currentPos = [START_X, START_Y];
            if (isBlocked(currentObj, currentPos)) {
                gameOver();
                return;
            }
        }
        nextOrigObj = randomObject();
        nextOrientation = rand(0, 3);
        nextObj = rotateObject(nextOrigObj, nextOrientation);
        if (!nextObjExists) {
            spawn();
        }
    }

    function moveDown(timerOnly) {
        if (isGameOver) {
            return;
        }

        if (!timerOnly) {
            currentPos[1] += GRIDSIZE;
            var i, j, row,
                gridCoords = pxToGrid(currentPos[0], currentPos[1]),
                rows = currentObj.rows,
                dim = objDimensions(currentObj, currentPos),
                blocked = (dim.y1 > GAMESIZE_Y) || isBlocked(currentObj, currentPos);

            if (blocked) {
                currentPos[1] -= GRIDSIZE; // revert moving down
                gridCoords = pxToGrid(currentPos[0], currentPos[1]);
                for (i = 0; i < rows.length; i++) {
                    row = rows[i];
                    for (j = 0; j < row.length; j++) {
                        if (row[j]) {
                            grid[j + gridCoords[0]][i + gridCoords[1]] = saturateColor(currentObj.color, 0.5);
                        }
                    }
                }
                beforeSpawn();
                updateHighscores();
                spawn();
            }
        }

        window.clearTimeout(currentTimeout);
        currentTimeout = window.setTimeout(moveDown, isFast ? FASTSPEED : SPEED);
    }

    function moveHorz(delta) {
        // delta: -1 = left, 1 = right
        if (isGameOver) {
            return;
        }

        var i, j, row, pos, gridCoords,
            rows = currentObj.rows,
            dim = objDimensions(currentObj, currentPos),
            blocked = (delta < 0 && currentPos[0] <= 0) || (delta > 0 && currentPos[0] + dim.realWidth >= GAMESIZE_X);
        if (!blocked) {
            gridCoords = pxToGrid(currentPos[0], currentPos[1]);
            for (i = 0; i < rows.length; i++) {
                row = rows[i];
                j = delta < 0 ? 0 : row.length - 1;
                pos = [gridCoords[0] + j + delta, gridCoords[1] + i];
                if (row[j] && grid[pos[0]][pos[1]]) {
                    blocked = true;
                    break;
                }
            }
        }
        if (!blocked) {
            currentPos[0] += GRIDSIZE * delta;
        }
    }

    function init() {
        // grid = [x][y]
        for (i = 0; i < GAMESIZE_X / GRIDSIZE; i++) {
            grid[i] = [];
            for (j = 0; j < GAMESIZE_Y / GRIDSIZE; j++) {
                grid[i][j] = null;
            }
        }
        SPEED = ORIG_SPEED;
        FASTSPEED = SPEED / FASTSPEED_FACTOR;
        points = deletedLines = level = 0;
        domi = isFast = isGameOver = false;
        nextObj = undefined;

        domElements.gameover.style.display = "none";

        updateHighscores();
        spawn();
        render();
        moveDown(true);
    }

    function keyDownHandler(e) {
        lastKeys = (lastKeys + String.fromCharCode(e.keyCode)).substr(-4);
        if (lastKeys === "DOMI" && !domi) {
            domi = true;
            deletedLines = 1000;
            points += 1e9;
            updateLevelAndSpeed();
            moveDown();
        }
        switch (e.keyCode) {
        case 32: // Space
        case 38: // Up
        case 87: // W
            currentOrientation = (currentOrientation + 1) % 4;
            var i, j, pos, row, blocked,
                rotatedObj = rotateObject(currentOrigObj, currentOrientation),
                rows = rotatedObj.rows,
                xDiff = Math.max(0, currentPos[0] + objDimensions(rotatedObj).realWidth - GAMESIZE_X),
                gridCoords = pxToGrid(currentPos[0], currentPos[1]);
            for (i = 0; i < rows.length; i++) {
                row = rows[i];
                for (j = 0; j < row.length; j++) {
                    pos = [gridCoords[0] + j - (xDiff / GRIDSIZE), gridCoords[1] + i];
                    if (grid[pos[0]][pos[1]]) {
                        blocked = true;
                        break;
                    }
                }
            }
            if (!blocked) {
                currentObj = rotatedObj;
                currentPos[0] -= xDiff;
            } else {
                currentOrientation = (currentOrientation + 3) % 4;
            }
            break;
        case 37: // Left
        case 65: // A
            moveHorz(-1);
            break;
        case 39: // Right
        case 68: // D
            moveHorz(1);
            break;
        case 40: // Down
        case 83: // S
            if (!isFast) {
                isFast = true;
                moveDown();
            }
            break;
        default:
            return;
        }
        e.preventDefault();
    }

    function keyUpHandler(e) {
        switch (e.keyCode) {
        case 40: // Down
        case 83: // S
            isFast = false;
            break;
        }
    }

    ["gameover", "gameover-retry", "a-score", "c-score"].forEach(function (elemId) {
        domElements[elemId] = document.getElementById(elemId);
    });

    document.addEventListener("keydown", keyDownHandler);
    document.addEventListener("keyup", keyUpHandler);
    domElements["gameover-retry"].addEventListener("click", init);

    init();
}());