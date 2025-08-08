/**
 * Voxel Game - Terrain Generator
 * Procedural terrain generation with Perlin noise
 * Version: 0.0.1
 */

export class TerrainGenerator {
    constructor(chunkSize, worldHeight) {
        this.chunkSize = chunkSize;
        this.worldHeight = worldHeight;
        
        // Generation parameters
        this.seed = Math.random() * 1000;
        this.scale = 0.05;
        this.octaves = 4;
        this.persistence = 0.5;
        this.lacunarity = 2;
        
        // Terrain levels
        this.waterLevel = 10;
        this.grassLevel = 15;
        this.stoneLevel = 5;
    }
    
    /**
     * Initialize terrain generator
     */
    async init() {
        // Could load heightmaps or other data here
        console.log('Terrain generator initialized with seed:', this.seed);
    }
    
    /**
     * Generate terrain for a chunk
     */
    async generateChunk(chunk) {
        const size = this.chunkSize;
        const worldX = chunk.position.x * size;
        const worldY = chunk.position.y * size;
        const worldZ = chunk.position.z * size;
        
        // Generate terrain
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                // Get height at this position
                const height = this.getHeightAt(worldX + x, worldZ + z);
                
                for (let y = 0; y < size; y++) {
                    const worldYPos = worldY + y;
                    
                    if (worldYPos < height) {
                        // Determine block type based on depth
                        let blockType = 1; // Default stone
                        
                        if (worldYPos < this.stoneLevel) {
                            blockType = 3; // Bedrock
                        } else if (worldYPos < height - 3) {
                            blockType = 1; // Stone
                        } else if (worldYPos < height - 1) {
                            blockType = 2; // Dirt
                        } else {
                            blockType = 4; // Grass
                        }
                        
                        chunk.setBlock(x, y, z, { type: blockType, solid: true });
                    }
                }
            }
        }
        
        // Build mesh after generation
        chunk.buildMesh();
    }
    
    /**
     * Get terrain height at world position
     */
    getHeightAt(x, z) {
        let height = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        
        for (let i = 0; i < this.octaves; i++) {
            height += this.noise2D(
                x * this.scale * frequency + this.seed,
                z * this.scale * frequency + this.seed
            ) * amplitude;
            
            maxValue += amplitude;
            amplitude *= this.persistence;
            frequency *= this.lacunarity;
        }
        
        // Normalize and scale height
        height = height / maxValue;
        height = (height + 1) * 0.5; // Convert from -1,1 to 0,1
        height = height * 30 + 5; // Scale to world height
        
        return Math.floor(height);
    }
    
    /**
     * Simple 2D noise function (simplified Perlin noise)
     */
    noise2D(x, y) {
        // This is a simplified noise function
        // In production, you'd use a proper Perlin noise implementation
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
    }
    
    /**
     * Destroy terrain generator
     */
    destroy() {
        // Cleanup if needed
    }
}