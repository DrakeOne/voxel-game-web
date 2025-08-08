/**
 * Voxel Game - Touch Controls
 * Mobile touch input handling
 * Version: 0.0.1
 */

export class TouchControls {
    constructor(player, config) {
        this.player = player;
        this.config = config;
        
        // Touch state
        this.touches = new Map();
        this.joystickActive = false;
        this.lookActive = false;
        
        // Joystick elements
        this.joystickBase = null;
        this.joystickKnob = null;
        this.joystickCenter = { x: 0, y: 0 };
        this.joystickRadius = 60;
        
        // Look controls
        this.lookStartPos = { x: 0, y: 0 };
        this.lookSensitivity = this.config.TOUCH_SENSITIVITY || 0.003;
    }
    
    /**
     * Initialize touch controls
     */
    init() {
        // Get joystick elements
        this.joystickBase = document.getElementById('joystickBase');
        this.joystickKnob = document.getElementById('joystickKnob');
        
        // Setup touch event listeners
        this.setupTouchEvents();
        
        // Setup button events
        this.setupButtonEvents();
        
        console.log('Touch controls initialized');
    }
    
    /**
     * Setup touch event listeners
     */
    setupTouchEvents() {
        const canvas = document.getElementById('gameCanvas');
        
        // Touch events on canvas for camera look
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        
        // Joystick events
        if (this.joystickBase) {
            this.joystickBase.addEventListener('touchstart', (e) => this.handleJoystickStart(e), { passive: false });
            this.joystickBase.addEventListener('touchmove', (e) => this.handleJoystickMove(e), { passive: false });
            this.joystickBase.addEventListener('touchend', (e) => this.handleJoystickEnd(e), { passive: false });
        }
    }
    
    /**
     * Setup button events
     */
    setupButtonEvents() {
        // Jump button
        const jumpBtn = document.getElementById('jumpBtn');
        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', () => {
                this.player.isJumping = true;
            });
            jumpBtn.addEventListener('touchend', () => {
                this.player.isJumping = false;
            });
        }
        
        // Break button
        const breakBtn = document.getElementById('breakBtn');
        if (breakBtn) {
            breakBtn.addEventListener('touchstart', () => {
                this.player.breakBlock();
            });
        }
        
        // Place button
        const placeBtn = document.getElementById('placeBtn');
        if (placeBtn) {
            placeBtn.addEventListener('touchstart', () => {
                this.player.placeBlock();
            });
        }
    }
    
    /**
     * Handle touch start on canvas
     */
    handleTouchStart(event) {
        event.preventDefault();
        
        for (const touch of event.changedTouches) {
            // Right side of screen for camera look
            if (touch.clientX > window.innerWidth / 2) {
                this.lookActive = true;
                this.lookStartPos = { x: touch.clientX, y: touch.clientY };
                this.touches.set(touch.identifier, { type: 'look', startX: touch.clientX, startY: touch.clientY });
            }
        }
    }
    
    /**
     * Handle touch move on canvas
     */
    handleTouchMove(event) {
        event.preventDefault();
        
        for (const touch of event.changedTouches) {
            const touchData = this.touches.get(touch.identifier);
            
            if (touchData && touchData.type === 'look') {
                const deltaX = touch.clientX - touchData.startX;
                const deltaY = touch.clientY - touchData.startY;
                
                this.player.handleMouseMove(deltaX * 2, deltaY * 2);
                
                touchData.startX = touch.clientX;
                touchData.startY = touch.clientY;
            }
        }
    }
    
    /**
     * Handle touch end
     */
    handleTouchEnd(event) {
        event.preventDefault();
        
        for (const touch of event.changedTouches) {
            this.touches.delete(touch.identifier);
        }
        
        if (this.touches.size === 0) {
            this.lookActive = false;
        }
    }
    
    /**
     * Handle joystick start
     */
    handleJoystickStart(event) {
        event.preventDefault();
        
        const touch = event.touches[0];
        const rect = this.joystickBase.getBoundingClientRect();
        
        this.joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        
        this.joystickActive = true;
        this.updateJoystick(touch.clientX, touch.clientY);
    }
    
    /**
     * Handle joystick move
     */
    handleJoystickMove(event) {
        event.preventDefault();
        
        if (!this.joystickActive) return;
        
        const touch = event.touches[0];
        this.updateJoystick(touch.clientX, touch.clientY);
    }
    
    /**
     * Handle joystick end
     */
    handleJoystickEnd(event) {
        event.preventDefault();
        
        this.joystickActive = false;
        
        // Reset joystick position
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = 'translate(-50%, -50%)';
        }
        
        // Reset player movement
        this.player.handleTouchMove(0, 0);
    }
    
    /**
     * Update joystick position
     */
    updateJoystick(touchX, touchY) {
        const deltaX = touchX - this.joystickCenter.x;
        const deltaY = touchY - this.joystickCenter.y;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        // Limit to joystick radius
        const limitedDistance = Math.min(distance, this.joystickRadius);
        
        // Calculate knob position
        const knobX = Math.cos(angle) * limitedDistance;
        const knobY = Math.sin(angle) * limitedDistance;
        
        // Update knob visual position
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        }
        
        // Calculate movement input (normalized -1 to 1)
        const moveX = knobX / this.joystickRadius;
        const moveY = knobY / this.joystickRadius;
        
        // Send movement to player
        this.player.handleTouchMove(moveX, moveY);
    }
    
    /**
     * Update touch controls
     */
    update(deltaTime) {
        // Any per-frame updates for touch controls
    }
    
    /**
     * Destroy touch controls
     */
    destroy() {
        // Remove event listeners
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.removeEventListener('touchstart', this.handleTouchStart);
            canvas.removeEventListener('touchmove', this.handleTouchMove);
            canvas.removeEventListener('touchend', this.handleTouchEnd);
        }
        
        console.log('Touch controls destroyed');
    }
}