/**
 * Voxel Game - Camera System
 * First-person camera with frustum culling support
 * Version: 0.0.1
 */

export class Camera {
    constructor(config) {
        this.config = config;
        
        // Camera position and rotation
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        
        // Camera properties
        this.fov = config.FOV || 75;
        this.aspect = 1;
        this.near = 0.1;
        this.far = 1000;
        
        // Frustum planes for culling
        this.frustumPlanes = [];
    }
    
    /**
     * Initialize camera
     */
    init() {
        this.updateAspect();
        console.log('Camera initialized');
    }
    
    /**
     * Update aspect ratio
     */
    updateAspect() {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            this.aspect = canvas.width / canvas.height;
        }
    }
    
    /**
     * Get ray direction from camera
     */
    getRayDirection() {
        // Calculate forward vector from rotation
        const pitch = this.rotation.x;
        const yaw = this.rotation.y;
        
        const x = -Math.sin(yaw) * Math.cos(pitch);
        const y = -Math.sin(pitch);
        const z = -Math.cos(yaw) * Math.cos(pitch);
        
        return { x, y, z };
    }
    
    /**
     * Get view matrix
     */
    getViewMatrix() {
        // This would be calculated by the renderer
        return null;
    }
    
    /**
     * Update frustum planes
     */
    updateFrustum(projectionMatrix, viewMatrix) {
        // Calculate frustum planes from matrices
        // This would be used for frustum culling
    }
    
    /**
     * Check if point is in frustum
     */
    isPointInFrustum(x, y, z) {
        // Simplified check - just use distance for now
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const dz = z - this.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        return distance < this.far;
    }
    
    /**
     * Check if box is in frustum
     */
    isBoxInFrustum(min, max) {
        // Simplified AABB frustum check
        const center = {
            x: (min.x + max.x) / 2,
            y: (min.y + max.y) / 2,
            z: (min.z + max.z) / 2
        };
        
        return this.isPointInFrustum(center.x, center.y, center.z);
    }
}