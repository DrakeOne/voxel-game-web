/**
 * Voxel Game - HUD System
 * Manages UI elements and display
 * Version: 0.0.1
 */

export class HUD {
    constructor(config, isMobile) {
        this.config = config;
        this.isMobile = isMobile;
        
        // HUD elements
        this.elements = {
            stats: null,
            inventory: null,
            crosshair: null,
            mobileControls: null
        };
        
        // State
        this.visible = true;
        this.debugMode = false;
    }
    
    /**
     * Initialize HUD
     */
    init() {
        // Get HUD elements
        this.elements.stats = document.getElementById('stats');
        this.elements.inventory = document.getElementById('inventoryBar');
        this.elements.mobileControls = document.getElementById('mobileHUD');
        
        // Show/hide mobile controls
        if (this.isMobile && this.elements.mobileControls) {
            this.elements.mobileControls.style.display = 'block';
        }
        
        // Create crosshair
        this.createCrosshair();
        
        console.log('HUD initialized');
    }
    
    /**
     * Create crosshair
     */
    createCrosshair() {
        const crosshair = document.createElement('div');
        crosshair.id = 'crosshair';
        crosshair.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 2px;
            height: 2px;
            background: white;
            box-shadow: 
                -10px 0 2px white,
                10px 0 2px white,
                0 -10px 2px white,
                0 10px 2px white;
            pointer-events: none;
            z-index: 1000;
        `;
        
        if (!this.isMobile) {
            document.body.appendChild(crosshair);
            this.elements.crosshair = crosshair;
        }
    }
    
    /**
     * Update HUD
     */
    update(performance, player) {
        // Update is handled by main.js updatePerformanceStats
    }
    
    /**
     * Handle resize
     */
    handleResize() {
        // Adjust HUD for new screen size
    }
    
    /**
     * Toggle debug mode
     */
    toggleDebug() {
        this.debugMode = !this.debugMode;
        
        if (this.elements.stats) {
            this.elements.stats.style.display = this.debugMode ? 'block' : 'none';
        }
    }
    
    /**
     * Show/hide HUD
     */
    setVisible(visible) {
        this.visible = visible;
        // Implementation for showing/hiding HUD elements
    }
}