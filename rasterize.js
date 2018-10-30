/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/ellipsoids.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var colorBuffer;
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader
var vertexColorAttrib; // where to put color for vertex shader

var matrixViewUniform;
var viewMatrix = mat4.create();

// Matrix logic
var matrixTranslateUniform;
var translateMatrix = mat4.create();

var translateVec = vec3.create();
var rotateVec = vec3.create();


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
        
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

function getColor(coord, index) {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != String.null) { 
		// color: Ka*La + Kd*Ld*(N(\dot)L) + Ks*Ls*(N(\dot)H)^n
		// looking at, L_'s are all 1.
		var lightCoord = [-1-coord[0], 3-coord[1], -0.5-coord[2]];
		
		var ambColor = inputTriangles[index].material.ambient; 
		var difColor = inputTriangles[index].material.diffuse;
		var spcColor = inputTriangles[index].material.specular;
		var n = inputTriangles[index].material.n;
		
		// Ambient
		//if (coord[0] == 0.25) console.log(ambColor);
		var ambR = ambColor[0];
		var ambG = ambColor[1];
		var ambB = ambColor[2];
		
		// Diffuse
		// "up" vector
		var N = [0,1,0]; // as stated in prog2 instructions
		
		// Normalize light source
		var lightMag = Math.sqrt(Math.pow(lightCoord[0],2) 
				+ Math.pow(lightCoord[1],2) 
				+ Math.pow(lightCoord[2],2));
		var L = [lightCoord[0]/lightMag, lightCoord[1]/lightMag, lightCoord[2]/lightMag];

		var NdotL = N[0]*L[0] + N[1]*L[1] + N[2]*L[2];
    //if (coord[0] == 0.25) console.log(L);
		
		var difR = difColor[0] * NdotL;
		var difG = difColor[1] * NdotL;
		var difB = difColor[2] * NdotL;
		
		//if (coord[0] == 0.25) console.log([difR,difG,difB]);
		//if (coord[0] == 0.25) console.log(difColor);
		
		// TODO Specular
		// Find NdotH
		// Find H 
		// Find V+L, and normalize(?)
		var V = [0.5, 0.5, -0.5]; // as stated in prog2 instructions
		var eyeMag = Math.sqrt(Math.pow(V[0],2) 
				+ Math.pow(V[1],2) 
				+ Math.pow(V[2],2));
		var VL_mag = Math.sqrt(Math.pow(V[0]/eyeMag+L[0],2)
				+ Math.pow(V[1]/eyeMag+L[1],2)
                + Math.pow(V[2]/eyeMag+L[2],2));

		var H = [(V[0]/eyeMag+L[0]) / VL_mag, 
             (V[1]/eyeMag+L[1]) / VL_mag, 
             (V[2]/eyeMag+L[2]) / VL_mag];
		
		var NdHpn = Math.pow(N[0]*H[0] + N[1]*H[1] + N[2]*H[2], inputTriangles[index].material.n);

		var spcR = spcColor[0] * NdHpn;
		var spcG = spcColor[1] * NdHpn;
		var spcB = spcColor[2] * NdHpn;
		//if (coord[0] == 0.25) console.log([spcR,spcG,spcB]);

		var r = ambR + difR + spcR;
		var g = ambG + difG + spcG;
		var b = ambB + difB + spcB;
				
    //if (coord[0] == 0.25) console.log([r*255,g*255,b*255]);
		//return [1.0, 1.0, 1.0, 1.0];
		return [r, g, b, 1.0];
    }
}

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var colorArray = [];
        
        // This is for the each set of triangles
        // Note this is not every triangle
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                var thisTriangleArray = inputTriangles[whichSet].triangles[whichSetTri];
                //console.log(thisTriangleArray);
                
                // NOW set up the vertex coord array
                for (whichSetVert=0; whichSetVert<thisTriangleArray.length; whichSetVert++){
                    index = thisTriangleArray[whichSetVert];
                    
                    var thisVertex = inputTriangles[whichSet].vertices[index];
                    
                    coordArray = coordArray.concat(thisVertex);
                    //console.log(thisVertex);
                    
                    // find 4D color for colorArray using thisVertex
                    var thisColor = getColor(thisVertex, whichSet);
                    colorArray = colorArray.concat(thisColor);
                }
            }
        } // end for each triangle set 
        triBufferSize = coordArray.length / 3;
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);
        
        //console.log(coordArray);
        //console.log(colorArray);
        
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
    	varying lowp vec4 vColor;
        void main(void) {
            //gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // all fragments are white
            gl_FragColor = vColor;
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec4 vertexColor;
        
        // My first matrix
        uniform mat4 translateMatrix;
        uniform mat4 viewMatrix;
        
        varying lowp vec4 vColor;

        void main(void) {
            gl_Position = viewMatrix*translateMatrix*vec4(vertexPosition, 1.0);
            vColor = vertexColor;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // Get location of attributes and uniforms
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                vertexColorAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexColor"); 
                matrixTranslateUniform = 
                    gl.getUniformLocation(shaderProgram, "translateMatrix");
                matrixViewUniform = 
                    gl.getUniformLocation(shaderProgram, "viewMatrix");
                
                // Enable attribures
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                gl.enableVertexAttribArray(vertexColorAttrib);
                
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    
    gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer); // TODO activate
    gl.vertexAttribPointer(vertexColorAttrib,4,gl.FLOAT,false,0,0); // feed
    
    // set uniforms (no need for buffers?)
    gl.uniformMatrix4fv(matrixViewUniform, false, viewMatrix);
    gl.uniformMatrix4fv(matrixTranslateUniform, false, translateMatrix);

    // TA said I need requestAnimationFrame() here
    requestAnimationFrame(renderTriangles);
    gl.drawArrays(gl.TRIANGLES,0,triBufferSize); // render
    //console.log(triBufferSize);
} // end render triangles

// listen for key input
function listen() {
    document.addEventListener('keydown', function (renderTriangles) {
        var key = renderTriangles.key || renderTriangles.keyCode;
        //console.log(key);
        // Translate view along x
        if (key == 'a')  {
            viewMatrix[12] -= 0.01;
        }
        if (key == 'd')  {
            viewMatrix[12] += 0.01;
        }
        // Translate view along z
        if (key == 'w')  {
            viewMatrix[11] += 0.01;
        }
        if (key == 's')  {
            viewMatrix[11] -= 0.01;
        }
        // Translate view along y
        if (key == 'q')  {
            viewMatrix[13] += 0.01;
        }
        if (key == 'e')  {
            viewMatrix[13] -= 0.01;
        }
        // Rotate view round Y
        if (key == 'A') {
            mat4.rotateY(viewMatrix,viewMatrix,0.01);
        }
        if (key == 'D') {
            mat4.rotateY(viewMatrix,viewMatrix,-0.01);
        }
        // Rotate view round Y
        if (key == 'W') {
            mat4.rotateX(viewMatrix,viewMatrix,-0.01);
        }
        if (key == 'S') {
            mat4.rotateX(viewMatrix,viewMatrix,0.01);
        }
        // Transform model
        if (key == 'k')  {
            translateVec = vec3.fromValues(-0.01,0,0);
            mat4.translate(translateMatrix,translateMatrix,translateVec);
        }
        if (key == ';')  {
            translateVec = vec3.fromValues(0.01,0,0);
            mat4.translate(translateMatrix,translateMatrix,translateVec);
        }
        if (key == 'o') {
            translateVec = vec3.fromValues(0,0,0.01);
            mat4.translate(translateMatrix,translateMatrix,translateVec);
        }
        if (key == 'l') {
            translateVec = vec3.fromValues(0,0,-0.01);
            mat4.translate(translateMatrix,translateMatrix,translateVec);
        }
        if (key == 'i') {
            translateVec = vec3.fromValues(0,0.01,0);
            mat4.translate(translateMatrix,translateMatrix,translateVec);
        }
        if (key == 'p') {
            translateVec = vec3.fromValues(0,-0.01,0);
            mat4.translate(translateMatrix,translateMatrix,translateVec);
        }
        // rotate model
        if (key == 'K')  {
            var axis = vec3.fromValues(viewMatrix[0],viewMatrix[1],viewMatrix[2]);
            mat4.rotate(translateMatrix,translateMatrix,0.1,axis);
        }
        if (key == ':')  {
            var axis = vec3.fromValues(viewMatrix[0],viewMatrix[1],viewMatrix[2]);
            mat4.rotate(translateMatrix,translateMatrix,-0.1,axis);
        }
        if (key == 'O')  {
            var axis = vec3.fromValues(viewMatrix[4],viewMatrix[5],viewMatrix[6]);
            mat4.rotate(translateMatrix,translateMatrix,-0.1,axis);
        }
        if (key == 'L')  {
            var axis = vec3.fromValues(viewMatrix[4],viewMatrix[5],viewMatrix[6]);
            mat4.rotate(translateMatrix,translateMatrix,0.1,axis);
        }
        if (key == 'I')  {
            var axis = vec3.fromValues(viewMatrix[8],viewMatrix[9],viewMatrix[10]);
            mat4.rotate(translateMatrix,translateMatrix,0.1,axis);
        }
        if (key == 'P')  {
            var axis = vec3.fromValues(viewMatrix[8],viewMatrix[9],viewMatrix[10]);
            mat4.rotate(translateMatrix,translateMatrix,-0.1,axis);
        }
        
        //console.log(translateMatrix);
        console.log(viewMatrix);
    });
}

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
  
        console.log(viewMatrix);
  
  listen();
  
} // end main
