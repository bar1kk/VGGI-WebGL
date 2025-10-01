'use strict';

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

// Parameters for the surface
const a = document.getElementById('a');
const b = document.getElementById('b');
const zStep = document.getElementById('zStep');
const angleStep = document.getElementById('angleStep');

let countHorizontalLines, countVerticalLines;

// Add event listeners to the input elements to redraw the surface when parameters change
[a, b, zStep, angleStep].forEach((el) =>
    el.addEventListener('change', () => {
        redraw();
    })
);

// Parametric equations of the Surface of Revolution “Pear” due to Encyclopedia of Mathematics; z=z from 0 to a; a,b - parameters
const X = (rZ, angle) => rZ * Math.sin(angle);
const Y = (rZ, angle) => rZ * Math.cos(angle);
const RZ = (z) => (z * Math.sqrt(z * (a.value - z))) / b.value;

// Function to redraw the surface when parameters change
function redraw() {
    surface.BufferData(CreateSurfaceData());
    draw();
}

//Function to reset parameters to default values
function resetParameters() {
    a.value = 3;
    b.value = 1;
    zStep.value = 0.1;
    angleStep.value = 15;
    redraw();
}

function deg2rad(angle) {
    return (angle * Math.PI) / 180;
}

// Constructor
function Model(name) {
    this.name = name;
    this.horizontalBuffer = gl.createBuffer();
    this.verticalBuffer = gl.createBuffer();
    this.horizontalVertices = [];
    this.verticalVertices = [];

    this.BufferData = function (surfaceData) {
        // Store horizontal lines data
        this.horizontalVertices = surfaceData.horizontal;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.horizontalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.horizontalVertices), gl.STREAM_DRAW);

        // Store vertical lines data
        this.verticalVertices = surfaceData.vertical;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.verticalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.verticalVertices), gl.STREAM_DRAW);
    };

    this.Draw = function () {
        // Draw horizontal lines
        gl.bindBuffer(gl.ARRAY_BUFFER, this.horizontalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        for (let i = 0; i < countHorizontalLines; i++) {
            let start = countVerticalLines * i;
            gl.drawArrays(gl.LINE_STRIP, start, countVerticalLines);
        }

        // Draw vertical lines
        gl.bindBuffer(gl.ARRAY_BUFFER, this.verticalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        for (let i = 0; i < countVerticalLines; i++) {
            let start = countHorizontalLines * i;
            gl.drawArrays(gl.LINE_STRIP, start, countHorizontalLines);
        }
    };
}

// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    };
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    // let projection = m4.perspective(Math.PI / 8, 1, 8, 12);
    let projection = m4.perspective(Math.PI / 3, 1, 1, 20);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    /* Draw the six faces of a cube, with different colors. */
    gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);

    surface.Draw();
}

function CreateSurfaceData() {
    let horizontalVertices = [];
    let verticalVertices = [];

    countHorizontalLines = 0;
    countVerticalLines = 0;

    let angleStepRad = deg2rad(angleStep.value);
    let zStepValue = parseFloat(zStep.value);

    // Create horizontal lines
    for (let z = 0; z <= a.value; z = +(z + zStepValue).toFixed(2)) {
        for (let angle = 0; angle <= 2 * Math.PI; angle += angleStepRad) {
            let rZ = RZ(z);
            let x = X(rZ, angle);
            let y = Y(rZ, angle);
            horizontalVertices.push(x, y, z);
        }
        countHorizontalLines++;
    }

    // Create vertical lines
    for (let angle = 0; angle <= 2 * Math.PI; angle += angleStepRad) {
        for (let z = 0; z <= a.value; z = +(z + zStepValue).toFixed(2)) {
            let rZ = RZ(z);
            let x = X(rZ, angle);
            let y = Y(rZ, angle);
            verticalVertices.push(x, y, z);
        }
        countVerticalLines++;
    }

    return {
        horizontal: horizontalVertices,
        vertical: verticalVertices
    };
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, 'vertex');
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, 'ModelViewProjectionMatrix');
    shProgram.iColor = gl.getUniformLocation(prog, 'color');

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData());

    gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error('Error in vertex shader:  ' + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error('Error in fragment shader:  ' + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Link error in program:  ' + gl.getProgramInfoLog(prog));
    }
    return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById('webglcanvas');
        gl = canvas.getContext('webgl');
        if (!gl) {
            throw 'Browser does not support WebGL';
        }
    } catch (e) {
        document.getElementById('canvas-holder').innerHTML = '<p>Sorry, could not get a WebGL graphics context.</p>';
        return;
    }
    try {
        initGL(); // initialize the WebGL graphics context
    } catch (e) {
        document.getElementById('canvas-holder').innerHTML =
            '<p>Sorry, could not initialize the WebGL graphics context: ' + e + '</p>';
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}
