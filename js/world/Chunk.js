/**
 * Voxel Game - Chunk System
 * Individual chunk management with optimized meshing
 * Version: 0.0.1
 */

export class Chunk {
    constructor(x, y, z, size) {
        this.position = { x, y, z };
        this.size = size;
        
        // Block data - 3D array
        this.blocks = new Uint8Array(size * size * size);
        
        // Mesh data
        this.mesh = null;
        this.vao = null;
        this.needsRebuild = true;
        
        // WebGL buffers
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.vertexCount = 0;
        this.indexCount = 0;
        
        // Chunk state
        this.isEmpty = true;
        this.isDirty = false;
    }
    
    /**
     * Get block at local position
     */
    getBlock(x, y, z) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size || z < 0 || z >= this.size) {
            return null;
        }
        
        const index = x + y * this.size + z * this.size * this.size;
        const blockType = this.blocks[index];
        
        return blockType > 0 ? { type: blockType, solid: true } : null;
    }
    
    /**
     * Set block at local position
     */
    setBlock(x, y, z, blockType) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size || z < 0 || z >= this.size) {
            return;
        }
        
        const index = x + y * this.size + z * this.size * this.size;
        this.blocks[index] = blockType ? blockType.type || 1 : 0;
        
        this.needsRebuild = true;
        this.isDirty = true;
        
        if (blockType) {
            this.isEmpty = false;
        }
    }
    
    /**
     * Build mesh from block data
     */
    buildMesh() {
        if (!this.needsRebuild) return;
        
        const vertices = [];
        const indices = [];
        let vertexCount = 0;
        
        // Simple meshing - create faces for each visible block face
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const block = this.getBlock(x, y, z);
                    if (!block) continue;
                    
                    // Check each face
                    // Top face (Y+)
                    if (!this.getBlock(x, y + 1, z)) {
                        this.addFace(vertices, indices, vertexCount, x, y, z, 'top');
                        vertexCount += 4;
                    }
                    
                    // Bottom face (Y-)
                    if (!this.getBlock(x, y - 1, z)) {
                        this.addFace(vertices, indices, vertexCount, x, y, z, 'bottom');
                        vertexCount += 4;
                    }
                    
                    // Front face (Z+)
                    if (!this.getBlock(x, y, z + 1)) {
                        this.addFace(vertices, indices, vertexCount, x, y, z, 'front');
                        vertexCount += 4;
                    }
                    
                    // Back face (Z-)
                    if (!this.getBlock(x, y, z - 1)) {
                        this.addFace(vertices, indices, vertexCount, x, y, z, 'back');
                        vertexCount += 4;
                    }
                    
                    // Right face (X+)
                    if (!this.getBlock(x + 1, y, z)) {
                        this.addFace(vertices, indices, vertexCount, x, y, z, 'right');
                        vertexCount += 4;
                    }
                    
                    // Left face (X-)
                    if (!this.getBlock(x - 1, y, z)) {
                        this.addFace(vertices, indices, vertexCount, x, y, z, 'left');
                        vertexCount += 4;
                    }
                }
            }
        }
        
        // Store mesh data
        this.mesh = {
            vertices: new Float32Array(vertices),
            indices: new Uint16Array(indices),
            vertexCount: vertexCount,
            indexCount: indices.length,
            stride: 36 // 3 pos + 2 uv + 3 normal + 4 color = 12 floats * 4 bytes
        };
        
        this.needsRebuild = false;
    }
    
    /**
     * Add a face to the mesh
     */
    addFace(vertices, indices, vertexOffset, x, y, z, face) {
        const positions = {
            top: [
                [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]
            ],
            bottom: [
                [0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]
            ],
            front: [
                [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
            ],
            back: [
                [1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]
            ],
            right: [
                [1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]
            ],
            left: [
                [0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]
            ]
        };
        
        const normals = {
            top: [0, 1, 0],
            bottom: [0, -1, 0],
            front: [0, 0, 1],
            back: [0, 0, -1],
            right: [1, 0, 0],
            left: [-1, 0, 0]
        };
        
        const uvs = [
            [0, 0], [1, 0], [1, 1], [0, 1]
        ];
        
        const facePositions = positions[face];
        const normal = normals[face];
        
        // Add vertices
        for (let i = 0; i < 4; i++) {
            const pos = facePositions[i];
            const uv = uvs[i];
            
            // Position
            vertices.push(x + pos[0], y + pos[1], z + pos[2]);
            // UV
            vertices.push(uv[0], uv[1]);
            // Normal
            vertices.push(normal[0], normal[1], normal[2]);
            // Color (white)
            vertices.push(1, 1, 1, 1);
        }
        
        // Add indices (two triangles)
        indices.push(
            vertexOffset, vertexOffset + 1, vertexOffset + 2,
            vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
    }
    
    /**
     * Create WebGL buffers
     */
    createBuffers(gl) {
        if (!this.mesh || this.mesh.vertexCount === 0) return;
        
        // Create vertex buffer
        if (!this.vertexBuffer) {
            this.vertexBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.mesh.vertices, gl.STATIC_DRAW);
        
        // Create index buffer
        if (!this.indexBuffer) {
            this.indexBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indices, gl.STATIC_DRAW);
        
        // Update counts
        this.vertexCount = this.mesh.vertexCount;
        this.indexCount = this.mesh.indexCount;
        
        // Store buffer references in mesh
        this.mesh.vertexBuffer = this.vertexBuffer;
        this.mesh.indexBuffer = this.indexBuffer;
    }
    
    /**
     * Destroy chunk and free resources
     */
    destroy() {
        this.blocks = null;
        this.mesh = null;
        
        // WebGL buffer cleanup would be done by the renderer
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.vao = null;
    }
}