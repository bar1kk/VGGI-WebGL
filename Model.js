'use strict';

// p: an array of xyz vertex coords
// t: an array of uv tex coords
function Vertex(p)
{
    this.p = p;
    this.uv = uv
    this.normal = [0, 0, 0];
    this.tangent = [0, 0, 0];
}

function Triangle(v0, v1, v2)
{
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    // this.normal = [];
    // this.tangent = [];
}

// Model Constructor function
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer(); 
    this.iTexCoordBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    this.idTextureDiffuse = -1;
    this.idTextureSpecular = -1;
    this.idTextureNormal = -1;

    // Buffer the data into the GPU
    this.BufferData = function(vertices, normals, tangents, texCoords, indices) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, tangents, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this.count = indices.length;
    }

    // Draw the model
    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);

        //gl.drawArrays(gl.LINE_STRIP, 0, this.count);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}


function CreateSurfaceData(data)
{
    // Parametric equations
    const X = (rZ, angle) => rZ * Math.sin(angle);
    const Y = (rZ, angle) => rZ * Math.cos(angle);
    const RZ = (z, a, b) => (z * Math.sqrt(z * (a - z))) / b;

    // Parameters from the UI
    let a = parseFloat(document.getElementById('a').value);
    let b = parseFloat(document.getElementById('b').value);
    let uDivs = parseInt(document.getElementById('uSlider').value);
    let vDivs = parseInt(document.getElementById('vSlider').value);

    let uStep = a / uDivs;
    let vStep = (2 * Math.PI) / vDivs;

    let vertices = [];
    let triangles = [];

    // Generate vertices
    for (let i = 0; i <= uDivs; i++) {
        let u = i * uStep;
        let rZ = RZ(u, a, b);
        for (let j = 0; j <= vDivs; j++) {
            let v = j * vStep;
            
            let x = X(rZ, v);
            let y = Y(rZ, v);
            let z = u;
            vertices.push( new Vertex([x, y, z]) );
        }
    }

    // Generate triangles
    for (let i = 0; i < uDivs; i++) {
        for (let j = 0; j < vDivs; j++) {
            let v0 = i * (vDivs + 1) + j;
            let v1 = v0 + 1;
            let v2 = (i + 1) * (vDivs + 1) + j;
            let v3 = v2 + 1;

            triangles.push( new Triangle(v0, v2, v1) );
            triangles.push( new Triangle(v1, v2, v3) );
        }
    }

    // Calculate normals (Faced Area Weighted Average)
    for (let tri of triangles) {
        // Vertices of the triangle
        let v0 = vertices[tri.v0];
        let v1 = vertices[tri.v1];
        let v2 = vertices[tri.v2];

        // Get their positions
        let vecA = m4.subtractVectors(v1.p, v0.p);
        let vecB = m4.subtractVectors(v2.p, v0.p);

        // Facet normal
        let facetNormal = m4.cross(vecA, vecB);

        // Add the facet normal to each vertex normal
        m4.addVectors(v0.normal, facetNormal, v0.normal);
        m4.addVectors(v1.normal, facetNormal, v1.normal);
        m4.addVectors(v2.normal, facetNormal, v2.normal);
    }

    // Prepare data arrays
    data.verticesF32 = new Float32Array(vertices.length*3);
    data.normalsF32 = new Float32Array(vertices.length*3);

    // Fill vertex and normal arrays
    for (let i=0; i<vertices.length; i++)
    {
        data.verticesF32[i*3 + 0] = vertices[i].p[0];
        data.verticesF32[i*3 + 1] = vertices[i].p[1];
        data.verticesF32[i*3 + 2] = vertices[i].p[2];

        // Normalize the normal vector
        let n = m4.normalize(vertices[i].normal);

        data.normalsF32[i*3 + 0] = n[0];
        data.normalsF32[i*3 + 1] = n[1];
        data.normalsF32[i*3 + 2] = n[2];
    }

    // Fill index array
    data.indicesU16 = new Uint16Array(triangles.length*3);
    for (let i=0; i<triangles.length; i++)
    {
        data.indicesU16[i*3 + 0] = triangles[i].v0;
        data.indicesU16[i*3 + 1] = triangles[i].v1;
        data.indicesU16[i*3 + 2] = triangles[i].v2;
    }
}