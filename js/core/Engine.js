/**
 * Voxel Game - Core Rendering Engine
 * WebGL2/WebGL1 renderer with maximum optimizations
 * Version: 0.0.1
 */

export class Engine {
    constructor(gl, config, isWebGL2) {
        this.gl = gl;
        this.config = config;
        this.isWebGL2 = isWebGL2;
        
        // Rendering state
        this.shaders = {};
        this.textures = {};
        this.buffers = {};
        this.vaos = {};
        this.fbos = {};
        
        // Matrices
        this.projectionMatrix = new Float32Array(16);
        this.viewMatrix = new Float32Array(16);
        this.modelMatrix = new Float32Array(16);
        this.mvpMatrix = new Float32Array(16);
        
        // Stats
        this.stats = {
            drawCalls: 0,
            vertices: 0,
            chunks: 0,
            triangles: 0
        };
        
        // Extensions for WebGL1
        this.extensions = {};
        
        // Instancing support
        this.supportsInstancing = false;
        this.instancedArraysExt = null;
        
        // VAO support
        this.supportsVAO = false;
        this.vaoExt = null;
    }
    
    /**
     * Initialize the rendering engine
     */
    async init() {
        const gl = this.gl;
        
        // Setup WebGL state
        this.setupWebGLState();
        
        // Load extensions
        this.loadExtensions();
        
        // Create shaders
        await this.createShaders();
        
        // Create textures
        await this.createTextures();
        
        // Setup render targets
        this.setupRenderTargets();
        
        // Initialize matrix library
        this.initMatrices();
        
        console.log('Engine initialized successfully');
    }
    
    /**
     * Setup initial WebGL state
     */
    setupWebGLState() {
        const gl = this.gl;
        
        // Enable depth testing
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
        // Enable face culling for performance
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);
        
        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Set clear color
        gl.clearColor(0.53, 0.81, 0.92, 1.0); // Sky blue
        
        // Set viewport
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
        // Disable unused features for performance
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.STENCIL_TEST);
        
        // Set pixel store parameters
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        
        // Enable anisotropic filtering if available
        const anisoExt = gl.getExtension('EXT_texture_filter_anisotropic') ||
                        gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
                        gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
        
        if (anisoExt) {
            this.maxAnisotropy = gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            this.anisoExt = anisoExt;
        }
    }
    
    /**
     * Load WebGL extensions
     */
    loadExtensions() {
        const gl = this.gl;
        
        if (this.isWebGL2) {
            // WebGL2 has these built-in
            this.supportsInstancing = true;
            this.supportsVAO = true;
        } else {
            // WebGL1 - load extensions
            
            // Instanced arrays
            this.instancedArraysExt = gl.getExtension('ANGLE_instanced_arrays');
            this.supportsInstancing = !!this.instancedArraysExt;
            
            // Vertex Array Objects
            this.vaoExt = gl.getExtension('OES_vertex_array_object');
            this.supportsVAO = !!this.vaoExt;
            
            // Other useful extensions
            this.extensions.depthTexture = gl.getExtension('WEBGL_depth_texture');
            this.extensions.drawBuffers = gl.getExtension('WEBGL_draw_buffers');
            this.extensions.standardDerivatives = gl.getExtension('OES_standard_derivatives');
            this.extensions.elementIndexUint = gl.getExtension('OES_element_index_uint');
            this.extensions.textureFloat = gl.getExtension('OES_texture_float');
            this.extensions.textureFloatLinear = gl.getExtension('OES_texture_float_linear');
        }
        
        console.log('Instancing support:', this.supportsInstancing);
        console.log('VAO support:', this.supportsVAO);
    }
    
    /**
     * Create shaders
     */
    async createShaders() {
        // Create main block shader with instancing support
        const vertexShaderSource = this.getVertexShaderSource();
        const fragmentShaderSource = this.getFragmentShaderSource();
        
        this.shaders.block = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        
        // Get uniform locations
        const shader = this.shaders.block;
        shader.uniforms = {
            uProjectionMatrix: this.gl.getUniformLocation(shader.program, 'uProjectionMatrix'),
            uViewMatrix: this.gl.getUniformLocation(shader.program, 'uViewMatrix'),
            uModelMatrix: this.gl.getUniformLocation(shader.program, 'uModelMatrix'),
            uTexture: this.gl.getUniformLocation(shader.program, 'uTexture'),
            uFogColor: this.gl.getUniformLocation(shader.program, 'uFogColor'),
            uFogNear: this.gl.getUniformLocation(shader.program, 'uFogNear'),
            uFogFar: this.gl.getUniformLocation(shader.program, 'uFogFar'),
            uTime: this.gl.getUniformLocation(shader.program, 'uTime'),
            uLightDirection: this.gl.getUniformLocation(shader.program, 'uLightDirection'),
            uAmbientLight: this.gl.getUniformLocation(shader.program, 'uAmbientLight')
        };
        
        // Get attribute locations
        shader.attributes = {
            aPosition: this.gl.getAttribLocation(shader.program, 'aPosition'),
            aTexCoord: this.gl.getAttribLocation(shader.program, 'aTexCoord'),
            aNormal: this.gl.getAttribLocation(shader.program, 'aNormal'),
            aColor: this.gl.getAttribLocation(shader.program, 'aColor')
        };
        
        if (this.supportsInstancing) {
            shader.attributes.aInstanceMatrix = this.gl.getAttribLocation(shader.program, 'aInstanceMatrix');
        }
    }
    
    /**
     * Get vertex shader source
     */
    getVertexShaderSource() {
        const precision = this.isWebGL2 ? '#version 300 es\n' : '';
        const attributeKeyword = this.isWebGL2 ? 'in' : 'attribute';
        const varyingKeyword = this.isWebGL2 ? 'out' : 'varying';
        
        return `${precision}
        precision highp float;
        
        ${attributeKeyword} vec3 aPosition;
        ${attributeKeyword} vec2 aTexCoord;
        ${attributeKeyword} vec3 aNormal;
        ${attributeKeyword} vec4 aColor;
        
        ${this.supportsInstancing ? `${attributeKeyword} mat4 aInstanceMatrix;` : ''}
        
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        
        ${varyingKeyword} vec2 vTexCoord;
        ${varyingKeyword} vec3 vNormal;
        ${varyingKeyword} vec4 vColor;
        ${varyingKeyword} float vFogDepth;
        ${varyingKeyword} vec3 vWorldPos;
        
        void main() {
            mat4 modelMatrix = ${this.supportsInstancing ? 'aInstanceMatrix' : 'uModelMatrix'};
            mat4 mvMatrix = uViewMatrix * modelMatrix;
            vec4 worldPos = modelMatrix * vec4(aPosition, 1.0);
            
            gl_Position = uProjectionMatrix * mvMatrix * vec4(aPosition, 1.0);
            
            vTexCoord = aTexCoord;
            vNormal = mat3(modelMatrix) * aNormal;
            vColor = aColor;
            vWorldPos = worldPos.xyz;
            
            // Calculate fog depth
            vec4 viewPos = mvMatrix * vec4(aPosition, 1.0);
            vFogDepth = -viewPos.z;
        }`;
    }
    
    /**
     * Get fragment shader source
     */
    getFragmentShaderSource() {
        const precision = this.isWebGL2 ? '#version 300 es\n' : '';
        const varyingKeyword = this.isWebGL2 ? 'in' : 'varying';
        const fragColor = this.isWebGL2 ? 'out vec4 fragColor;' : '';
        const outputColor = this.isWebGL2 ? 'fragColor' : 'gl_FragColor';
        
        return `${precision}
        precision mediump float;
        
        ${varyingKeyword} vec2 vTexCoord;
        ${varyingKeyword} vec3 vNormal;
        ${varyingKeyword} vec4 vColor;
        ${varyingKeyword} float vFogDepth;
        ${varyingKeyword} vec3 vWorldPos;
        
        uniform sampler2D uTexture;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform float uTime;
        uniform vec3 uLightDirection;
        uniform vec3 uAmbientLight;
        
        ${fragColor}
        
        void main() {
            // Sample texture
            vec4 texColor = texture2D(uTexture, vTexCoord);
            
            // Discard transparent pixels
            if (texColor.a < 0.1) discard;
            
            // Apply vertex color
            vec4 color = texColor * vColor;
            
            // Simple directional lighting
            vec3 normal = normalize(vNormal);
            float lightIntensity = max(dot(normal, -uLightDirection), 0.0);
            vec3 diffuse = lightIntensity * vec3(1.0);
            vec3 ambient = uAmbientLight;
            
            // Apply lighting
            color.rgb *= (ambient + diffuse);
            
            // Apply fog
            float fogFactor = clamp((uFogFar - vFogDepth) / (uFogFar - uFogNear), 0.0, 1.0);
            color.rgb = mix(uFogColor, color.rgb, fogFactor);
            
            ${outputColor} = color;
        }`;
    }
    
    /**
     * Create shader program
     */
    createShaderProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        
        // Create vertex shader
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
            return null;
        }
        
        // Create fragment shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
            return null;
        }
        
        // Create program
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Shader program linking error:', gl.getProgramInfoLog(program));
            return null;
        }
        
        // Clean up shaders
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        
        return { program };
    }
    
    /**
     * Create textures
     */
    async createTextures() {
        // Create texture atlas
        this.textures.atlas = await this.loadTexture('assets/textures/atlas.png');
        
        // Create white texture for fallback
        this.textures.white = this.createWhiteTexture();
    }
    
    /**
     * Load texture from URL
     */
    async loadTexture(url) {
        const gl = this.gl;
        
        return new Promise((resolve) => {
            const texture = gl.createTexture();
            const image = new Image();
            
            // Use white texture while loading
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                         new Uint8Array([255, 255, 255, 255]));
            
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                
                // Generate mipmaps for better quality
                gl.generateMipmap(gl.TEXTURE_2D);
                
                // Set texture parameters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                
                // Apply anisotropic filtering if available
                if (this.anisoExt) {
                    gl.texParameterf(gl.TEXTURE_2D, this.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, 
                                   Math.min(4, this.maxAnisotropy));
                }
                
                resolve(texture);
            };
            
            image.onerror = () => {
                console.warn(`Failed to load texture: ${url}`);
                resolve(this.textures.white);
            };
            
            image.src = url;
        });
    }
    
    /**
     * Create white texture
     */
    createWhiteTexture() {
        const gl = this.gl;
        const texture = gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                     new Uint8Array([255, 255, 255, 255]));
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
        return texture;
    }
    
    /**
     * Setup render targets for post-processing
     */
    setupRenderTargets() {
        if (!this.config.ENABLE_POST_PROCESSING) return;
        
        // Create framebuffer for post-processing
        // Implementation would go here
    }
    
    /**
     * Initialize matrix math
     */
    initMatrices() {
        // Setup projection matrix
        this.updateProjectionMatrix(this.config.FOV, 
                                   this.gl.canvas.width / this.gl.canvas.height,
                                   0.1, 1000.0);
        
        // Initialize view matrix to identity
        this.setIdentityMatrix(this.viewMatrix);
        
        // Initialize model matrix to identity
        this.setIdentityMatrix(this.modelMatrix);
    }
    
    /**
     * Update projection matrix
     */
    updateProjectionMatrix(fov, aspect, near, far) {
        const f = 1.0 / Math.tan((fov * Math.PI / 180) / 2);
        const rangeInv = 1 / (near - far);
        
        this.projectionMatrix[0] = f / aspect;
        this.projectionMatrix[1] = 0;
        this.projectionMatrix[2] = 0;
        this.projectionMatrix[3] = 0;
        
        this.projectionMatrix[4] = 0;
        this.projectionMatrix[5] = f;
        this.projectionMatrix[6] = 0;
        this.projectionMatrix[7] = 0;
        
        this.projectionMatrix[8] = 0;
        this.projectionMatrix[9] = 0;
        this.projectionMatrix[10] = (near + far) * rangeInv;
        this.projectionMatrix[11] = -1;
        
        this.projectionMatrix[12] = 0;
        this.projectionMatrix[13] = 0;
        this.projectionMatrix[14] = near * far * rangeInv * 2;
        this.projectionMatrix[15] = 0;
    }
    
    /**
     * Set identity matrix
     */
    setIdentityMatrix(matrix) {
        matrix[0] = 1; matrix[1] = 0; matrix[2] = 0; matrix[3] = 0;
        matrix[4] = 0; matrix[5] = 1; matrix[6] = 0; matrix[7] = 0;
        matrix[8] = 0; matrix[9] = 0; matrix[10] = 1; matrix[11] = 0;
        matrix[12] = 0; matrix[13] = 0; matrix[14] = 0; matrix[15] = 1;
    }
    
    /**
     * Clear the frame
     */
    clear() {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Reset stats
        this.stats.drawCalls = 0;
        this.stats.vertices = 0;
        this.stats.chunks = 0;
        this.stats.triangles = 0;
    }
    
    /**
     * Render the world
     */
    renderWorld(world, camera) {
        const gl = this.gl;
        
        // Use block shader
        const shader = this.shaders.block;
        gl.useProgram(shader.program);
        
        // Update view matrix from camera
        this.updateViewMatrix(camera);
        
        // Set uniforms
        gl.uniformMatrix4fv(shader.uniforms.uProjectionMatrix, false, this.projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.uViewMatrix, false, this.viewMatrix);
        
        // Set fog uniforms
        gl.uniform3f(shader.uniforms.uFogColor, 0.53, 0.81, 0.92);
        gl.uniform1f(shader.uniforms.uFogNear, this.config.RENDER_DISTANCE * 16 * 0.5);
        gl.uniform1f(shader.uniforms.uFogFar, this.config.RENDER_DISTANCE * 16);
        
        // Set lighting uniforms
        gl.uniform3f(shader.uniforms.uLightDirection, 0.3, -1.0, 0.5);
        gl.uniform3f(shader.uniforms.uAmbientLight, 0.4, 0.4, 0.4);
        
        // Set time uniform for animations
        gl.uniform1f(shader.uniforms.uTime, performance.now() / 1000);
        
        // Bind texture atlas
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.atlas || this.textures.white);
        gl.uniform1i(shader.uniforms.uTexture, 0);
        
        // Render chunks
        const visibleChunks = world.getVisibleChunks(camera);
        
        for (const chunk of visibleChunks) {
            if (chunk.mesh && chunk.mesh.vertexCount > 0) {
                this.renderChunk(chunk, shader);
            }
        }
        
        return this.stats;
    }
    
    /**
     * Render a single chunk
     */
    renderChunk(chunk, shader) {
        const gl = this.gl;
        
        // Bind chunk VAO if available
        if (this.supportsVAO && chunk.vao) {
            if (this.isWebGL2) {
                gl.bindVertexArray(chunk.vao);
            } else {
                this.vaoExt.bindVertexArrayOES(chunk.vao);
            }
        } else {
            // Bind buffers manually
            this.bindChunkBuffers(chunk, shader);
        }
        
        // Set model matrix for chunk position
        this.setTranslationMatrix(this.modelMatrix, 
                                 chunk.position.x * 16,
                                 chunk.position.y * 16,
                                 chunk.position.z * 16);
        
        gl.uniformMatrix4fv(shader.uniforms.uModelMatrix, false, this.modelMatrix);
        
        // Draw
        if (chunk.mesh.indexBuffer) {
            gl.drawElements(gl.TRIANGLES, chunk.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawArrays(gl.TRIANGLES, 0, chunk.mesh.vertexCount);
        }
        
        // Update stats
        this.stats.drawCalls++;
        this.stats.vertices += chunk.mesh.vertexCount;
        this.stats.triangles += chunk.mesh.vertexCount / 3;
        this.stats.chunks++;
        
        // Unbind VAO
        if (this.supportsVAO) {
            if (this.isWebGL2) {
                gl.bindVertexArray(null);
            } else {
                this.vaoExt.bindVertexArrayOES(null);
            }
        }
    }
    
    /**
     * Bind chunk buffers manually
     */
    bindChunkBuffers(chunk, shader) {
        const gl = this.gl;
        const mesh = chunk.mesh;
        
        // Bind vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
        
        // Setup attributes
        const stride = mesh.stride || 0;
        let offset = 0;
        
        // Position
        gl.enableVertexAttribArray(shader.attributes.aPosition);
        gl.vertexAttribPointer(shader.attributes.aPosition, 3, gl.FLOAT, false, stride, offset);
        offset += 12;
        
        // Texture coordinates
        if (shader.attributes.aTexCoord >= 0) {
            gl.enableVertexAttribArray(shader.attributes.aTexCoord);
            gl.vertexAttribPointer(shader.attributes.aTexCoord, 2, gl.FLOAT, false, stride, offset);
            offset += 8;
        }
        
        // Normal
        if (shader.attributes.aNormal >= 0) {
            gl.enableVertexAttribArray(shader.attributes.aNormal);
            gl.vertexAttribPointer(shader.attributes.aNormal, 3, gl.FLOAT, false, stride, offset);
            offset += 12;
        }
        
        // Color
        if (shader.attributes.aColor >= 0) {
            gl.enableVertexAttribArray(shader.attributes.aColor);
            gl.vertexAttribPointer(shader.attributes.aColor, 4, gl.FLOAT, false, stride, offset);
        }
        
        // Bind index buffer if available
        if (mesh.indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        }
    }
    
    /**
     * Update view matrix from camera
     */
    updateViewMatrix(camera) {
        // Simple view matrix calculation
        const pos = camera.position;
        const rot = camera.rotation;
        
        // Create rotation matrices
        const cosX = Math.cos(rot.x);
        const sinX = Math.sin(rot.x);
        const cosY = Math.cos(rot.y);
        const sinY = Math.sin(rot.y);
        
        // Combined rotation and translation
        this.viewMatrix[0] = cosY;
        this.viewMatrix[1] = sinX * sinY;
        this.viewMatrix[2] = -cosX * sinY;
        this.viewMatrix[3] = 0;
        
        this.viewMatrix[4] = 0;
        this.viewMatrix[5] = cosX;
        this.viewMatrix[6] = sinX;
        this.viewMatrix[7] = 0;
        
        this.viewMatrix[8] = sinY;
        this.viewMatrix[9] = -sinX * cosY;
        this.viewMatrix[10] = cosX * cosY;
        this.viewMatrix[11] = 0;
        
        this.viewMatrix[12] = -(this.viewMatrix[0] * pos.x + this.viewMatrix[4] * pos.y + this.viewMatrix[8] * pos.z);
        this.viewMatrix[13] = -(this.viewMatrix[1] * pos.x + this.viewMatrix[5] * pos.y + this.viewMatrix[9] * pos.z);
        this.viewMatrix[14] = -(this.viewMatrix[2] * pos.x + this.viewMatrix[6] * pos.y + this.viewMatrix[10] * pos.z);
        this.viewMatrix[15] = 1;
    }
    
    /**
     * Set translation matrix
     */
    setTranslationMatrix(matrix, x, y, z) {
        matrix[0] = 1; matrix[1] = 0; matrix[2] = 0; matrix[3] = 0;
        matrix[4] = 0; matrix[5] = 1; matrix[6] = 0; matrix[7] = 0;
        matrix[8] = 0; matrix[9] = 0; matrix[10] = 1; matrix[11] = 0;
        matrix[12] = x; matrix[13] = y; matrix[14] = z; matrix[15] = 1;
    }
    
    /**
     * Render HUD elements
     */
    renderHUD(hud) {
        // HUD rendering would be implemented here
        // This would include crosshair, inventory, etc.
    }
    
    /**
     * Handle window resize
     */
    handleResize(width, height) {
        this.gl.viewport(0, 0, width, height);
        this.updateProjectionMatrix(this.config.FOV, width / height, 0.1, 1000.0);
    }
    
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = config;
        
        // Update projection matrix if FOV changed
        this.updateProjectionMatrix(this.config.FOV,
                                   this.gl.canvas.width / this.gl.canvas.height,
                                   0.1, 1000.0);
    }
    
    /**
     * Destroy engine and cleanup resources
     */
    destroy() {
        const gl = this.gl;
        
        // Delete shaders
        for (const shader of Object.values(this.shaders)) {
            if (shader && shader.program) {
                gl.deleteProgram(shader.program);
            }
        }
        
        // Delete textures
        for (const texture of Object.values(this.textures)) {
            if (texture) {
                gl.deleteTexture(texture);
            }
        }
        
        // Delete buffers
        for (const buffer of Object.values(this.buffers)) {
            if (buffer) {
                gl.deleteBuffer(buffer);
            }
        }
        
        // Delete VAOs
        if (this.supportsVAO) {
            for (const vao of Object.values(this.vaos)) {
                if (vao) {
                    if (this.isWebGL2) {
                        gl.deleteVertexArray(vao);
                    } else {
                        this.vaoExt.deleteVertexArrayOES(vao);
                    }
                }
            }
        }
        
        console.log('Engine destroyed');
    }
}