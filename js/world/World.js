/**
 * Voxel Game - World Management System
 * Handles chunk loading, unloading, and world generation
 * Version: 0.0.1
 */

import { Chunk } from './Chunk.js';
import { TerrainGenerator } from './TerrainGenerator.js';

export class World {
    constructor(config, pools) {
        this.config = config;
        this.pools = pools;
        
        // World data
        this.chunks = new Map();
        this.activeChunks = new Set();
        this.chunkLoadQueue = [];
        this.chunkUnloadQueue = [];
        
        // World settings
        this.chunkSize = config.CHUNK_SIZE || 16;
        this.worldHeight = config.WORLD_HEIGHT || 128;
        this.renderDistance = config.RENDER_DISTANCE || 8;
        
        // Terrain generator
        this.terrainGenerator = null;
        
        // Performance
        this.maxChunksPerFrame = 2;
        this.lastChunkUpdate = 0;
        this.chunkUpdateInterval = 100; // ms
    }
    
    /**
     * Initialize world
     */
    async init() {
        // Initialize terrain generator
        this.terrainGenerator = new TerrainGenerator(this.chunkSize, this.worldHeight);
        await this.terrainGenerator.init();
        
        // Generate initial chunks around origin
        await this.generateInitialChunks();
        
        console.log('World initialized with', this.chunks.size, 'chunks');
    }
    
    /**
     * Generate initial chunks around spawn point
     */
    async generateInitialChunks() {
        const initialRadius = 2;
        
        for (let x = -initialRadius; x <= initialRadius; x++) {
            for (let z = -initialRadius; z <= initialRadius; z++) {
                for (let y = 0; y < Math.ceil(this.worldHeight / this.chunkSize); y++) {
                    const chunk = await this.loadChunk(x, y, z);
                    if (chunk) {
                        this.activeChunks.add(chunk);
                    }
                }
            }
        }
    }
    
    /**
     * Load or generate a chunk
     */
    async loadChunk(x, y, z) {
        const key = `${x},${y},${z}`;
        
        // Check if chunk already exists
        if (this.chunks.has(key)) {
            return this.chunks.get(key);
        }
        
        // Create new chunk
        const chunk = new Chunk(x, y, z, this.chunkSize);
        
        // Generate terrain for chunk
        await this.terrainGenerator.generateChunk(chunk);
        
        // Build mesh for chunk
        chunk.buildMesh();
        
        // Store chunk
        this.chunks.set(key, chunk);
        
        return chunk;
    }
    
    /**
     * Unload a chunk
     */
    unloadChunk(x, y, z) {
        const key = `${x},${y},${z}`;
        const chunk = this.chunks.get(key);
        
        if (chunk) {
            chunk.destroy();
            this.chunks.delete(key);
            this.activeChunks.delete(chunk);
        }
    }
    
    /**
     * Update world based on player position
     */
    update(playerPosition, deltaTime) {
        const now = performance.now();
        
        // Throttle chunk updates
        if (now - this.lastChunkUpdate < this.chunkUpdateInterval) {
            return;
        }
        
        this.lastChunkUpdate = now;
        
        // Calculate player chunk position
        const playerChunkX = Math.floor(playerPosition.x / this.chunkSize);
        const playerChunkY = Math.floor(playerPosition.y / this.chunkSize);
        const playerChunkZ = Math.floor(playerPosition.z / this.chunkSize);
        
        // Load chunks around player
        this.updateChunksAroundPlayer(playerChunkX, playerChunkY, playerChunkZ);
        
        // Process chunk queues
        this.processChunkQueues();
    }
    
    /**
     * Update chunks around player
     */
    updateChunksAroundPlayer(centerX, centerY, centerZ) {
        const renderDist = this.renderDistance;
        
        // Mark all chunks for potential unload
        const chunksToCheck = new Set(this.activeChunks);
        
        // Check which chunks should be loaded
        for (let x = centerX - renderDist; x <= centerX + renderDist; x++) {
            for (let z = centerZ - renderDist; z <= centerZ + renderDist; z++) {
                for (let y = 0; y < Math.ceil(this.worldHeight / this.chunkSize); y++) {
                    const distance = Math.sqrt(
                        Math.pow(x - centerX, 2) + 
                        Math.pow(z - centerZ, 2)
                    );
                    
                    if (distance <= renderDist) {
                        const key = `${x},${y},${z}`;
                        
                        if (!this.chunks.has(key)) {
                            // Queue chunk for loading
                            this.queueChunkLoad(x, y, z);
                        } else {
                            // Chunk should stay active
                            const chunk = this.chunks.get(key);
                            chunksToCheck.delete(chunk);
                        }
                    }
                }
            }
        }
        
        // Queue remaining chunks for unload
        for (const chunk of chunksToCheck) {
            this.queueChunkUnload(chunk);
        }
    }
    
    /**
     * Queue chunk for loading
     */
    queueChunkLoad(x, y, z) {
        const key = `${x},${y},${z}`;
        
        // Check if already queued
        const alreadyQueued = this.chunkLoadQueue.some(
            item => item.key === key
        );
        
        if (!alreadyQueued) {
            this.chunkLoadQueue.push({ x, y, z, key });
        }
    }
    
    /**
     * Queue chunk for unloading
     */
    queueChunkUnload(chunk) {
        if (!this.chunkUnloadQueue.includes(chunk)) {
            this.chunkUnloadQueue.push(chunk);
        }
    }
    
    /**
     * Process chunk loading/unloading queues
     */
    processChunkQueues() {
        // Process chunk loads
        let chunksLoaded = 0;
        while (this.chunkLoadQueue.length > 0 && chunksLoaded < this.maxChunksPerFrame) {
            const { x, y, z } = this.chunkLoadQueue.shift();
            this.loadChunk(x, y, z).then(chunk => {
                if (chunk) {
                    this.activeChunks.add(chunk);
                }
            });
            chunksLoaded++;
        }
        
        // Process chunk unloads
        let chunksUnloaded = 0;
        while (this.chunkUnloadQueue.length > 0 && chunksUnloaded < this.maxChunksPerFrame) {
            const chunk = this.chunkUnloadQueue.shift();
            this.unloadChunk(chunk.position.x, chunk.position.y, chunk.position.z);
            chunksUnloaded++;
        }
    }
    
    /**
     * Get visible chunks for rendering
     */
    getVisibleChunks(camera) {
        const visibleChunks = [];
        
        for (const chunk of this.activeChunks) {
            // Simple frustum culling check
            if (this.isChunkInFrustum(chunk, camera)) {
                visibleChunks.push(chunk);
            }
        }
        
        // Sort by distance for better rendering order
        const cameraPos = camera.position;
        visibleChunks.sort((a, b) => {
            const distA = this.getChunkDistance(a, cameraPos);
            const distB = this.getChunkDistance(b, cameraPos);
            return distA - distB;
        });
        
        return visibleChunks;
    }
    
    /**
     * Check if chunk is in camera frustum
     */
    isChunkInFrustum(chunk, camera) {
        // Simplified frustum check - just use distance for now
        const distance = this.getChunkDistance(chunk, camera.position);
        return distance < this.renderDistance * this.chunkSize * 1.5;
    }
    
    /**
     * Get distance from chunk to position
     */
    getChunkDistance(chunk, position) {
        const chunkCenter = {
            x: (chunk.position.x + 0.5) * this.chunkSize,
            y: (chunk.position.y + 0.5) * this.chunkSize,
            z: (chunk.position.z + 0.5) * this.chunkSize
        };
        
        return Math.sqrt(
            Math.pow(chunkCenter.x - position.x, 2) +
            Math.pow(chunkCenter.y - position.y, 2) +
            Math.pow(chunkCenter.z - position.z, 2)
        );
    }
    
    /**
     * Get block at world position
     */
    getBlock(x, y, z) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        
        const key = `${chunkX},${chunkY},${chunkZ}`;
        const chunk = this.chunks.get(key);
        
        if (chunk) {
            const localX = x - chunkX * this.chunkSize;
            const localY = y - chunkY * this.chunkSize;
            const localZ = z - chunkZ * this.chunkSize;
            
            return chunk.getBlock(localX, localY, localZ);
        }
        
        return null;
    }
    
    /**
     * Set block at world position
     */
    setBlock(x, y, z, blockType) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        
        const key = `${chunkX},${chunkY},${chunkZ}`;
        const chunk = this.chunks.get(key);
        
        if (chunk) {
            const localX = x - chunkX * this.chunkSize;
            const localY = y - chunkY * this.chunkSize;
            const localZ = z - chunkZ * this.chunkSize;
            
            chunk.setBlock(localX, localY, localZ, blockType);
            chunk.needsRebuild = true;
            
            // Mark neighboring chunks for rebuild if on edge
            this.markNeighborChunksForRebuild(chunk, localX, localY, localZ);
        }
    }
    
    /**
     * Mark neighboring chunks for rebuild
     */
    markNeighborChunksForRebuild(chunk, localX, localY, localZ) {
        const size = this.chunkSize - 1;
        
        if (localX === 0) this.markChunkForRebuild(chunk.position.x - 1, chunk.position.y, chunk.position.z);
        if (localX === size) this.markChunkForRebuild(chunk.position.x + 1, chunk.position.y, chunk.position.z);
        if (localY === 0) this.markChunkForRebuild(chunk.position.x, chunk.position.y - 1, chunk.position.z);
        if (localY === size) this.markChunkForRebuild(chunk.position.x, chunk.position.y + 1, chunk.position.z);
        if (localZ === 0) this.markChunkForRebuild(chunk.position.x, chunk.position.y, chunk.position.z - 1);
        if (localZ === size) this.markChunkForRebuild(chunk.position.x, chunk.position.y, chunk.position.z + 1);
    }
    
    /**
     * Mark chunk for rebuild
     */
    markChunkForRebuild(x, y, z) {
        const key = `${x},${y},${z}`;
        const chunk = this.chunks.get(key);
        
        if (chunk) {
            chunk.needsRebuild = true;
        }
    }
    
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = config;
        this.renderDistance = config.RENDER_DISTANCE || this.renderDistance;
    }
    
    /**
     * Destroy world and cleanup
     */
    destroy() {
        // Destroy all chunks
        for (const chunk of this.chunks.values()) {
            chunk.destroy();
        }
        
        this.chunks.clear();
        this.activeChunks.clear();
        this.chunkLoadQueue = [];
        this.chunkUnloadQueue = [];
        
        // Destroy terrain generator
        if (this.terrainGenerator) {
            this.terrainGenerator.destroy();
        }
        
        console.log('World destroyed');
    }
}