/**
 * Voxel Game - Player Controller
 * Handles player movement, physics, and input
 * Version: 0.0.1
 */

import { Camera } from './Camera.js';

export class Player {
    constructor(world, config) {
        this.world = world;
        this.config = config;
        
        // Position and movement
        this.position = { x: 0, y: 20, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        
        // Player properties
        this.height = 1.8;
        this.width = 0.6;
        this.eyeHeight = 1.6;
        this.speed = this.config.MOVE_SPEED || 5;
        this.jumpForce = this.config.JUMP_FORCE || 8;
        this.gravity = this.config.GRAVITY || -9.81 * 3;
        
        // State flags
        this.isGrounded = false;
        this.isJumping = false;
        this.isSprinting = false;
        this.isCrouching = false;
        this.isFlying = false;
        this.pointerLocked = false;
        
        // Input state
        this.keys = {};
        this.mouseButtons = {};
        this.touchInput = { x: 0, y: 0 };
        
        // Camera
        this.camera = null;
        
        // Collision
        this.collisionEnabled = true;
        this.boundingBox = {
            min: { x: -this.width/2, y: 0, z: -this.width/2 },
            max: { x: this.width/2, y: this.height, z: this.width/2 }
        };
    }
    
    /**
     * Initialize player
     */
    init() {
        // Create camera
        this.camera = new Camera(this.config);
        this.camera.init();
        
        // Set initial camera position
        this.updateCameraPosition();
        
        console.log('Player initialized at', this.position);
    }
    
    /**
     * Update player state
     */
    update(deltaTime) {
        // Handle input
        this.handleMovement(deltaTime);
        
        // Apply physics
        if (!this.isFlying) {
            this.applyGravity(deltaTime);
        }
        
        // Update velocity
        this.updateVelocity(deltaTime);
        
        // Check collisions
        if (this.collisionEnabled) {
            this.checkCollisions();
        }
        
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
        
        // Check ground
        this.checkGrounded();
        
        // Update camera
        this.updateCameraPosition();
    }
    
    /**
     * Handle movement input
     */
    handleMovement(deltaTime) {
        const moveSpeed = this.isSprinting ? this.speed * 1.5 : this.speed;
        const moveVector = { x: 0, y: 0, z: 0 };
        
        // Forward/Backward
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            moveVector.z -= 1;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            moveVector.z += 1;
        }
        
        // Left/Right
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            moveVector.x -= 1;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            moveVector.x += 1;
        }
        
        // Add touch input
        moveVector.x += this.touchInput.x;
        moveVector.z += this.touchInput.y;
        
        // Normalize movement vector
        const length = Math.sqrt(moveVector.x * moveVector.x + moveVector.z * moveVector.z);
        if (length > 0) {
            moveVector.x /= length;
            moveVector.z /= length;
        }
        
        // Apply rotation to movement
        const sin = Math.sin(this.rotation.y);
        const cos = Math.cos(this.rotation.y);
        
        const moveX = moveVector.x * cos - moveVector.z * sin;
        const moveZ = moveVector.x * sin + moveVector.z * cos;
        
        // Apply movement
        this.velocity.x = moveX * moveSpeed;
        this.velocity.z = moveZ * moveSpeed;
        
        // Jump
        if ((this.keys['Space'] || this.isJumping) && this.isGrounded && !this.isFlying) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }
        
        // Flying controls
        if (this.isFlying) {
            if (this.keys['Space']) {
                this.velocity.y = moveSpeed;
            } else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
                this.velocity.y = -moveSpeed;
            } else {
                this.velocity.y = 0;
            }
        }
    }
    
    /**
     * Apply gravity
     */
    applyGravity(deltaTime) {
        if (!this.isGrounded) {
            this.velocity.y += this.gravity * deltaTime;
            
            // Terminal velocity
            if (this.velocity.y < -50) {
                this.velocity.y = -50;
            }
        }
    }
    
    /**
     * Update velocity with friction
     */
    updateVelocity(deltaTime) {
        if (this.isGrounded && !this.isFlying) {
            // Ground friction
            const friction = 10;
            this.velocity.x *= Math.max(0, 1 - friction * deltaTime);
            this.velocity.z *= Math.max(0, 1 - friction * deltaTime);
        } else if (this.isFlying) {
            // Air friction for flying
            const friction = 5;
            this.velocity.x *= Math.max(0, 1 - friction * deltaTime);
            this.velocity.y *= Math.max(0, 1 - friction * deltaTime);
            this.velocity.z *= Math.max(0, 1 - friction * deltaTime);
        }
    }
    
    /**
     * Check collisions with world
     */
    checkCollisions() {
        // Simple AABB collision with blocks
        const futurePos = {
            x: this.position.x + this.velocity.x * 0.016,
            y: this.position.y + this.velocity.y * 0.016,
            z: this.position.z + this.velocity.z * 0.016
        };
        
        // Check X axis
        if (this.checkCollisionAt(futurePos.x, this.position.y, this.position.z)) {
            this.velocity.x = 0;
        }
        
        // Check Y axis
        if (this.checkCollisionAt(this.position.x, futurePos.y, this.position.z)) {
            if (this.velocity.y < 0) {
                this.isGrounded = true;
            }
            this.velocity.y = 0;
        }
        
        // Check Z axis
        if (this.checkCollisionAt(this.position.x, this.position.y, futurePos.z)) {
            this.velocity.z = 0;
        }
    }
    
    /**
     * Check collision at position
     */
    checkCollisionAt(x, y, z) {
        // Check corners of bounding box
        const corners = [
            { x: x + this.boundingBox.min.x, y: y + this.boundingBox.min.y, z: z + this.boundingBox.min.z },
            { x: x + this.boundingBox.max.x, y: y + this.boundingBox.min.y, z: z + this.boundingBox.min.z },
            { x: x + this.boundingBox.min.x, y: y + this.boundingBox.max.y, z: z + this.boundingBox.min.z },
            { x: x + this.boundingBox.max.x, y: y + this.boundingBox.max.y, z: z + this.boundingBox.min.z },
            { x: x + this.boundingBox.min.x, y: y + this.boundingBox.min.y, z: z + this.boundingBox.max.z },
            { x: x + this.boundingBox.max.x, y: y + this.boundingBox.min.y, z: z + this.boundingBox.max.z },
            { x: x + this.boundingBox.min.x, y: y + this.boundingBox.max.y, z: z + this.boundingBox.max.z },
            { x: x + this.boundingBox.max.x, y: y + this.boundingBox.max.y, z: z + this.boundingBox.max.z }
        ];
        
        for (const corner of corners) {
            const block = this.world.getBlock(
                Math.floor(corner.x),
                Math.floor(corner.y),
                Math.floor(corner.z)
            );
            
            if (block && block.solid) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if player is on ground
     */
    checkGrounded() {
        const groundY = this.position.y - 0.1;
        const block = this.world.getBlock(
            Math.floor(this.position.x),
            Math.floor(groundY),
            Math.floor(this.position.z)
        );
        
        this.isGrounded = block && block.solid;
    }
    
    /**
     * Update camera position
     */
    updateCameraPosition() {
        if (this.camera) {
            this.camera.position.x = this.position.x;
            this.camera.position.y = this.position.y + this.eyeHeight;
            this.camera.position.z = this.position.z;
            
            this.camera.rotation.x = this.rotation.x;
            this.camera.rotation.y = this.rotation.y;
            this.camera.rotation.z = this.rotation.z;
        }
    }
    
    /**
     * Handle keyboard input
     */
    handleKeyDown(key) {
        this.keys[key] = true;
        
        // Toggle flying with F
        if (key === 'KeyF') {
            this.isFlying = !this.isFlying;
            if (this.isFlying) {
                this.velocity.y = 0;
            }
        }
        
        // Sprint with Shift
        if (key === 'ShiftLeft' || key === 'ShiftRight') {
            this.isSprinting = true;
        }
        
        // Crouch with Control
        if (key === 'ControlLeft' || key === 'ControlRight') {
            this.isCrouching = true;
        }
    }
    
    handleKeyUp(key) {
        this.keys[key] = false;
        
        // Stop sprinting
        if (key === 'ShiftLeft' || key === 'ShiftRight') {
            this.isSprinting = false;
        }
        
        // Stop crouching
        if (key === 'ControlLeft' || key === 'ControlRight') {
            this.isCrouching = false;
        }
    }
    
    /**
     * Handle mouse movement
     */
    handleMouseMove(deltaX, deltaY) {
        if (!this.pointerLocked) return;
        
        const sensitivity = this.config.MOUSE_SENSITIVITY || 0.002;
        
        // Update rotation
        this.rotation.y -= deltaX * sensitivity;
        this.rotation.x -= deltaY * sensitivity;
        
        // Clamp vertical rotation
        this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
        
        // Wrap horizontal rotation
        if (this.rotation.y > Math.PI) {
            this.rotation.y -= Math.PI * 2;
        } else if (this.rotation.y < -Math.PI) {
            this.rotation.y += Math.PI * 2;
        }
    }
    
    /**
     * Handle mouse buttons
     */
    handleMouseDown(button) {
        this.mouseButtons[button] = true;
        
        // Left click - break block
        if (button === 0) {
            this.breakBlock();
        }
        
        // Right click - place block
        if (button === 2) {
            this.placeBlock();
        }
    }
    
    handleMouseUp(button) {
        this.mouseButtons[button] = false;
    }
    
    /**
     * Handle touch input
     */
    handleTouchMove(x, y) {
        this.touchInput.x = x;
        this.touchInput.y = y;
    }
    
    /**
     * Set pointer lock state
     */
    setPointerLocked(locked) {
        this.pointerLocked = locked;
    }
    
    /**
     * Break block
     */
    breakBlock() {
        const ray = this.camera.getRayDirection();
        const maxDistance = 5;
        
        for (let distance = 0; distance < maxDistance; distance += 0.1) {
            const checkPos = {
                x: Math.floor(this.camera.position.x + ray.x * distance),
                y: Math.floor(this.camera.position.y + ray.y * distance),
                z: Math.floor(this.camera.position.z + ray.z * distance)
            };
            
            const block = this.world.getBlock(checkPos.x, checkPos.y, checkPos.z);
            
            if (block && block.solid) {
                this.world.setBlock(checkPos.x, checkPos.y, checkPos.z, null);
                break;
            }
        }
    }
    
    /**
     * Place block
     */
    placeBlock() {
        const ray = this.camera.getRayDirection();
        const maxDistance = 5;
        let lastEmpty = null;
        
        for (let distance = 0; distance < maxDistance; distance += 0.1) {
            const checkPos = {
                x: Math.floor(this.camera.position.x + ray.x * distance),
                y: Math.floor(this.camera.position.y + ray.y * distance),
                z: Math.floor(this.camera.position.z + ray.z * distance)
            };
            
            const block = this.world.getBlock(checkPos.x, checkPos.y, checkPos.z);
            
            if (block && block.solid) {
                if (lastEmpty) {
                    // Place block at last empty position
                    this.world.setBlock(lastEmpty.x, lastEmpty.y, lastEmpty.z, { type: 'stone', solid: true });
                }
                break;
            }
            
            lastEmpty = checkPos;
        }
    }
    
    /**
     * Teleport player to position
     */
    teleport(x, y, z) {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;
        this.updateCameraPosition();
    }
    
    /**
     * Reset player
     */
    reset() {
        this.teleport(0, 20, 0);
        this.rotation.x = 0;
        this.rotation.y = 0;
        this.rotation.z = 0;
        this.isFlying = false;
        this.isSprinting = false;
        this.isCrouching = false;
    }
}