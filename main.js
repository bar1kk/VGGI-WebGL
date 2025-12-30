'use strict';

let gl; // The webgl context.
let surface; // A surface model
let marker;
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

// Links to the HTML elements
let a_input, b_input, u_slider, v_slider, tex_scale_slider, tex_scale_val;

let textureCenter = [0.5, 0.5]; 
let textureScale = 1.0;

// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    //Atributes
    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    this.iAttribTexCoord = -1;
    //Uniforms
    this.iProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;
    this.iLightPosition = -1;
    // Material properties
    this.iTexDiffuse = -1;
    this.iTexSpecular = -1;
    this.iTexNormal = -1;

    // New uniforms for scaling
    this.iTexScale = -1;
    this.iTexCenter = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    };
}

function redraw() {
    let data = {};

    CreateSurfaceData(data);
    surface.BufferData(data.verticesF32, data.normalsF32, data.tangentsF32, data.texCoordsF32, data.indicesU16);
    draw();
}

function resetParameters() {
    a_input.value = 3.0;
    b_input.value = 1.0;
    u_slider.value = 30;
    v_slider.value = 30;

    tex_scale_slider.value = 1.0;
    document.getElementById('texScaleValue').innerText = "1.0";
    textureScale = 1.0;
    textureCenter = [0.5, 0.5];
    redraw();
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 4, 1, 1, 20);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();
    let scaleMatrix = m4.scaling(1.25, 1.25, 1.25);
    let modelViewScaled = m4.multiply(modelView, scaleMatrix);
    let translateToPointZero = m4.translation(0, 1, -10);
    let matAccum1 = m4.multiply(translateToPointZero, modelViewScaled);

    let normalMatrix = m4.inverse(matAccum1);
    m4.transpose(normalMatrix, normalMatrix);

    // Light position in eye-space
    const lightWorldPos = [5.0, 3.0, 5.0];
    let lightEyePos = m4.transformPoint(modelView, lightWorldPos);

    shProgram.Use();

    // Set the uniform variables for the shaders
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);
    gl.uniform3fv(shProgram.iLightPosition, lightEyePos);
    //Bind texture units to samplers
    gl.uniform1i(shProgram.iTexDiffuse, 0);
    gl.uniform1i(shProgram.iTexSpecular, 1);
    gl.uniform1i(shProgram.iTexNormal, 2);

    gl.uniform3f(shProgram.iAmbientLightColor, 0.2, 0.2, 0.2); 
    gl.uniform3f(shProgram.iDiffuseLightColor, 0.8, 0.8, 0.8); 
    gl.uniform3f(shProgram.iSpecularLightColor, 1.0, 1.0, 1.0);
    gl.uniform1f(shProgram.iShininess, 10.0);

    // Pass scaling parameters
    gl.uniform1f(shProgram.iTexScale, textureScale);
    gl.uniform2fv(shProgram.iTexCenter, textureCenter);

    surface.Draw();

    // Draw marker
    let a = parseFloat(a_input.value);
    let b = parseFloat(b_input.value);

    // Map texture coordinates back to 3D surface point
    let u_tex = textureCenter[0]; 
    let v_tex = textureCenter[1];

    // Calculate Z based on V texture coordinate
    let z_point = v_tex * a; 
    
    // Calculate Radius RZ
    const RZ = (z, a, b) => (z * Math.sqrt(z * (a - z))) / b;
    let r_point = (z_point >= a) ? 0 : RZ(z_point, a, b);

    // Calculate Angle based on U texture coordinate
    let angle_point = (1.0 - u_tex) * 2 * Math.PI;

    // Calculate X and Y
    let x_point = r_point * Math.sin(angle_point);
    let y_point = r_point * Math.cos(angle_point);

    // Move marker to this position
    let translateMarker = m4.translation(x_point, y_point, z_point);
    let markerMatrix = m4.multiply(matAccum1, translateMarker);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, markerMatrix);
    
    // Make marker bright red (high ambient, no diffuse/specular)
    gl.uniform3f(shProgram.iAmbientLightColor, 1.0, 0.0, 0.0); 
    gl.uniform3f(shProgram.iDiffuseLightColor, 0.0, 0.0, 0.0);
    gl.uniform3f(shProgram.iSpecularLightColor, 0.0, 0.0, 0.0);

    marker.Draw();
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('NormalMapShader', prog);
    shProgram.Use();

    // Get the location of the attribute and uniform variables
    shProgram.iAttribVertex = gl.getAttribLocation(prog, 'a_VertexPosition');
    shProgram.iAttribNormal = gl.getAttribLocation(prog, 'a_VertexNormal');
    shProgram.iAttribTangent = gl.getAttribLocation(prog, 'a_VertexTangent');
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, 'a_TexCoord');

    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, 'u_ProjectionMatrix');
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, 'u_ModelViewMatrix');
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, 'u_NormalMatrix');
    shProgram.iLightPosition = gl.getUniformLocation(prog, 'u_LightPosition');

    shProgram.iTexDiffuse = gl.getUniformLocation(prog, 'u_TextureDiffuse');
    shProgram.iTexSpecular = gl.getUniformLocation(prog, 'u_TextureSpecular');
    shProgram.iTexNormal = gl.getUniformLocation(prog, 'u_TextureNormal');

    shProgram.iAmbientLightColor = gl.getUniformLocation(prog, 'u_AmbientLightColor');
    shProgram.iDiffuseLightColor = gl.getUniformLocation(prog, 'u_DiffuseLightColor');
    shProgram.iSpecularLightColor = gl.getUniformLocation(prog, 'u_SpecularLightColor');
    shProgram.iShininess = gl.getUniformLocation(prog, 'u_Shininess');

    // Get locations for new uniforms
    shProgram.iTexScale = gl.getUniformLocation(prog, 'u_TexScale');
    shProgram.iTexCenter = gl.getUniformLocation(prog, 'u_TexCenter');

    surface = new Model('Surface');

    surface.idTextureDiffuse = LoadTexture('./textures/diffuse.png');
    surface.idTextureSpecular = LoadTexture('./textures/specular.png');
    surface.idTextureNormal = LoadTexture('./textures/normal.png');

    // Create marker
    marker = new Model('Marker');
    CreateSphere(marker, 0.05);
    // Reuse textures (shader expects them bound)
    marker.idTextureDiffuse = surface.idTextureDiffuse; 
    marker.idTextureSpecular = surface.idTextureSpecular;
    marker.idTextureNormal = surface.idTextureNormal;

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.2, 0.2, 0.2, 1);
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
    a_input = document.getElementById('a');
    b_input = document.getElementById('b');
    u_slider = document.getElementById('uSlider');
    v_slider = document.getElementById('vSlider');
    tex_scale_slider = document.getElementById('texScale');
    tex_scale_val = document.getElementById('texScaleValue');

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

    // Event listeners for the sliders and inputs
    [a_input, b_input, u_slider, v_slider, tex_scale_slider].forEach((el) => {
        el.addEventListener('input', () => {
             if(el === tex_scale_slider) {
                 textureScale = parseFloat(el.value);
                 tex_scale_val.innerText = textureScale; 
             }
             redraw();
        });
    });

    // Keyboard handler fow WASD
    window.addEventListener('keydown', (e) => {
        const step = 0.02;
        switch (e.code) {
            case 'KeyA': 
                textureCenter[0] += step;
                break;
            case 'KeyD': 
                textureCenter[0] -= step;
                break;
            case 'KeyW': 
                textureCenter[1] -= step;
                break;
            case 'KeyS': 
                textureCenter[1] += step;
                break;
            default:
                return;
        }

        textureCenter[0] = Math.max(0.0, Math.min(1.0, textureCenter[0]));
        textureCenter[1] = Math.max(0.0, Math.min(1.0, textureCenter[1]));
        
        draw();
    });

    redraw();
}
