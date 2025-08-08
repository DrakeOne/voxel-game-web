/**
 * Voxel Game - Main Entry Point
 * Version: 0.0.1
 * Optimized for maximum performance on web and mobile
 */

// Import modules with proper error handling
const loadModules = async () => {
    try {
        const modules = await Promise.all([
            import('./core/Engine.js'),
            import('./world/World.js'),
            import('./player/Player.js'),
            import('./ui/HUD.js'),
            import('./ui/TouchControls.js'),
            import('./optimization/ObjectPool.js')
        ]);
        
        return {
            Engine: modules[0].Engine,
            World: modules[1].World,
            Player: modules[2].Player,
            HUD: modules[3].HUD,
            TouchControls: modules[4].TouchControls,
            ObjectPool: modules[5].ObjectPool
        };
    } catch (error) {
        console.error('Failed to load modules:', error);
        throw error;
    }
};

// Game configuration with performance settings
const CONFIG = {
    VERSION: '0.0.1',
    TARGET_FPS: 60,
    MOBILE_TARGET_FPS: 30,
    RENDER_DISTANCE: 8, // chunks
    MOBILE_RENDER_DISTANCE: 4,
    CHUNK_SIZE: 16,
    WORLD_HEIGHT: 128,
    FOV: 75,
    MOBILE_FOV: 60,
    MOUSE_SENSITIVITY: 0.002,
    TOUCH_SENSITIVITY: 0.003,
    GRAVITY: -9.81 * 3,
    JUMP_FORCE: 8,
    MOVE_SPEED: 5,
    ENABLE_SHADOWS: true,
    ENABLE_PARTICLES: true,
    ENABLE_POST_PROCESSING: false,
    AUTO_QUALITY: true,
    MAX_DRAW_CALLS: 100,
    MAX_VERTICES: 1000000,
    TEXTURE_ATLAS_SIZE: 256,
    BLOCK_TEXTURE_SIZE: 16
};

// Performance monitoring
const PERFORMANCE = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    vertices: 0,
    chunks: 0,
    lastTime: performance.now(),
    frameCount: 0,
    fpsUpdateInterval: 500,
    lastFpsUpdate: 0,
    lowFpsCount: 0,
    qualityLevel: 'high' // 'low', 'medium', 'high', 'ultra'
};

class VoxelGame {
    constructor(modules) {
        this.modules = modules;
        this.config = { ...CONFIG };
        this.performance = { ...PERFORMANCE };
        this.isRunning = false;
        this.isPaused = false;
        this.isMobile = this.detectMobile();
        
        // Adjust config for mobile
        if (this.isMobile) {
            this.config.TARGET_FPS = this.config.MOBILE_TARGET_FPS;
            this.config.RENDER_DISTANCE = this.config.MOBILE_RENDER_DISTANCE;
            this.config.FOV = this.config.MOBILE_FOV;
            this.config.ENABLE_SHADOWS = false;
            this.config.ENABLE_PARTICLES = false;
        }
        
        // Initialize object pools for memory optimization
        this.initializeObjectPools();
    }
    
    /**
     * Detect if running on mobile device
     */
    detectMobile() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth <= 768;
        
        return isTouchDevice && (isMobileUserAgent || isSmallScreen);
    }
    
    /**
     * Initialize object pools for memory management
     */
    initializeObjectPools() {
        const { ObjectPool } = this.modules;
        
        this.pools = {
            vectors: new ObjectPool(() => ({ x: 0, y: 0, z: 0 }), null, 1000),
            matrices: new ObjectPool(() => new Float32Array(16), null, 100),
            chunks: new ObjectPool(() => ({}), null, 50),
            particles: new ObjectPool(() => ({}), null, 500)
        };
    }
    
    /**
     * Initialize the game
     */
    async init() {
        try {
            // Update loading screen
            this.updateLoadingProgress(10, 'Initializing WebGL context...');
            
            // Get canvas element
            this.canvas = document.getElementById('gameCanvas');
            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }
            
            // Set canvas size
            this.resizeCanvas();
            
            // Initialize WebGL context with best settings
            const contextOptions = {
                alpha: false,
                antialias: !this.isMobile,
                depth: true,
                stencil: false,
                powerPreference: 'high-performance',
                preserveDrawingBuffer: false,
                premultipliedAlpha: false,
                desynchronized: true,
                failIfMajorPerformanceCaveat: false
            };
            
            // Try WebGL2 first, fallback to WebGL1
            this.gl = this.canvas.getContext('webgl2', contextOptions) || 
                      this.canvas.getContext('webgl', contextOptions) ||
                      this.canvas.getContext('experimental-webgl', contextOptions);
            
            if (!this.gl) {
                throw new Error('WebGL not supported');
            }
            
            this.isWebGL2 = this.gl instanceof WebGL2RenderingContext;
            console.log(`Using ${this.isWebGL2 ? 'WebGL2' : 'WebGL1'}`);
            
            // Update loading progress
            this.updateLoadingProgress(20, 'Creating game engine...');
            
            // Initialize game engine
            const { Engine } = this.modules;
            this.engine = new Engine(this.gl, this.config, this.isWebGL2);
            await this.engine.init();
            
            // Update loading progress
            this.updateLoadingProgress(40, 'Generating world...');
            
            // Initialize world
            const { World } = this.modules;
            this.world = new World(this.config, this.pools);
            await this.world.init();
            
            // Update loading progress
            this.updateLoadingProgress(60, 'Creating player...');
            
            // Initialize player
            const { Player } = this.modules;
            this.player = new Player(this.world, this.config);
            this.player.init();
            
            // Update loading progress
            this.updateLoadingProgress(80, 'Setting up controls...');
            
            // Initialize HUD
            const { HUD } = this.modules;
            this.hud = new HUD(this.config, this.isMobile);
            this.hud.init();
            
            // Initialize controls
            if (this.isMobile) {
                const { TouchControls } = this.modules;
                this.touchControls = new TouchControls(this.player, this.config);
                this.touchControls.init();
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update loading progress
            this.updateLoadingProgress(100, 'Starting game...');
            
            // Hide loading screen after a short delay
            setTimeout(() => {
                this.hideLoadingScreen();
                this.start();
            }, 500);
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showError(error.message);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.handleResize(), false);
        window.addEventListener('orientationchange', () => this.handleResize(), false);
        
        // Page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
        
        // Keyboard controls (desktop)
        if (!this.isMobile) {
            document.addEventListener('keydown', (e) => this.handleKeyDown(e));
            document.addEventListener('keyup', (e) => this.handleKeyUp(e));
            
            // Mouse controls
            this.canvas.addEventListener('click', () => this.requestPointerLock());
            document.addEventListener('pointerlockchange', () => this.handlePointerLockChange());
            document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        }
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Performance monitoring
        if (this.config.AUTO_QUALITY) {
            setInterval(() => this.adjustQuality(), 5000);
        }
    }
    
    /**
     * Request pointer lock for mouse controls
     */
    requestPointerLock() {
        if (!this.isMobile && !document.pointerLockElement) {
            this.canvas.requestPointerLock = this.canvas.requestPointerLock ||
                                           this.canvas.mozRequestPointerLock ||
                                           this.canvas.webkitRequestPointerLock;
            if (this.canvas.requestPointerLock) {
                this.canvas.requestPointerLock();
            }
        }
    }
    
    /**
     * Handle pointer lock change
     */
    handlePointerLockChange() {
        const isLocked = document.pointerLockElement === this.canvas ||
                        document.mozPointerLockElement === this.canvas ||
                        document.webkitPointerLockElement === this.canvas;
        
        if (this.player) {
            this.player.setPointerLocked(isLocked);
        }
    }
    
    /**
     * Handle keyboard input
     */
    handleKeyDown(event) {
        if (this.isPaused || !this.player) return;
        this.player.handleKeyDown(event.code);
    }
    
    handleKeyUp(event) {
        if (!this.player) return;
        this.player.handleKeyUp(event.code);
    }
    
    /**
     * Handle mouse movement
     */
    handleMouseMove(event) {
        if (this.isPaused || !document.pointerLockElement || !this.player) return;
        
        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
        
        this.player.handleMouseMove(movementX, movementY);
    }
    
    /**
     * Handle mouse buttons
     */
    handleMouseDown(event) {
        if (this.isPaused || !this.player) return;
        this.player.handleMouseDown(event.button);
    }
    
    handleMouseUp(event) {
        if (!this.player) return;
        this.player.handleMouseUp(event.button);
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        this.resizeCanvas();
        if (this.engine) {
            this.engine.handleResize(this.canvas.width, this.canvas.height);
        }
        if (this.hud) {
            this.hud.handleResize();
        }
    }
    
    /**
     * Resize canvas to match window
     */
    resizeCanvas() {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance
        this.canvas.width = window.innerWidth * pixelRatio;
        this.canvas.height = window.innerHeight * pixelRatio;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
    }
    
    /**
     * Start the game loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        
        // Start game loop
        this.gameLoop();
        
        console.log(`Voxel Game v${this.config.VERSION} started!`);
    }
    
    /**
     * Main game loop
     */
    gameLoop() {
        if (!this.isRunning) return;
        
        // Request next frame with optimal timing
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
        
        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
        this.lastTime = currentTime;
        
        // Skip frame if too slow
        if (deltaTime > 1 / 15) return; // Skip if below 15 FPS
        
        // Update game state
        if (!this.isPaused) {
            this.update(deltaTime);
        }
        
        // Render frame
        this.render(deltaTime);
        
        // Update performance stats
        this.updatePerformanceStats(deltaTime);
    }
    
    /**
     * Update game state
     */
    update(deltaTime) {
        // Update player
        if (this.player) {
            this.player.update(deltaTime);
        }
        
        // Update world
        if (this.world && this.player) {
            this.world.update(this.player.position, deltaTime);
        }
        
        // Update HUD
        if (this.hud) {
            this.hud.update(this.performance, this.player);
        }
        
        // Update touch controls if mobile
        if (this.isMobile && this.touchControls) {
            this.touchControls.update(deltaTime);
        }
    }
    
    /**
     * Render frame
     */
    render(deltaTime) {
        if (!this.engine || !this.world || !this.player) return;
        
        // Clear frame
        this.engine.clear();
        
        // Render world
        const renderStats = this.engine.renderWorld(this.world, this.player.camera);
        
        // Update performance metrics
        if (renderStats) {
            this.performance.drawCalls = renderStats.drawCalls;
            this.performance.vertices = renderStats.vertices;
            this.performance.chunks = renderStats.chunks;
        }
        
        // Render HUD elements
        if (this.hud) {
            this.engine.renderHUD(this.hud);
        }
    }
    
    /**
     * Update performance statistics
     */
    updatePerformanceStats(deltaTime) {
        this.performance.frameTime = deltaTime * 1000;
        this.performance.frameCount++;
        
        const now = performance.now();
        if (now - this.performance.lastFpsUpdate >= this.performance.fpsUpdateInterval) {
            this.performance.fps = Math.round(this.performance.frameCount * 1000 / (now - this.performance.lastFpsUpdate));
            this.performance.frameCount = 0;
            this.performance.lastFpsUpdate = now;
            
            // Update FPS display
            const fpsElement = document.getElementById('fps');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${this.performance.fps}`;
            }
            
            // Update other stats
            const chunksElement = document.getElementById('chunks');
            if (chunksElement) {
                chunksElement.textContent = `Chunks: ${this.performance.chunks}`;
            }
            
            const verticesElement = document.getElementById('vertices');
            if (verticesElement) {
                verticesElement.textContent = `Vertices: ${this.performance.vertices.toLocaleString()}`;
            }
            
            const drawCallsElement = document.getElementById('drawCalls');
            if (drawCallsElement) {
                drawCallsElement.textContent = `Draw Calls: ${this.performance.drawCalls}`;
            }
        }
    }
    
    /**
     * Automatically adjust quality based on performance
     */
    adjustQuality() {
        if (!this.config.AUTO_QUALITY) return;
        
        const fps = this.performance.fps;
        const targetFps = this.config.TARGET_FPS;
        
        if (fps < targetFps * 0.5) {
            // Very low FPS - reduce quality
            this.performance.lowFpsCount++;
            
            if (this.performance.lowFpsCount > 3) {
                this.decreaseQuality();
                this.performance.lowFpsCount = 0;
            }
        } else if (fps > targetFps * 0.9) {
            // Good FPS - can increase quality
            this.performance.lowFpsCount = 0;
            
            if (this.performance.qualityLevel !== 'ultra') {
                this.increaseQuality();
            }
        }
    }
    
    /**
     * Decrease rendering quality
     */
    decreaseQuality() {
        const levels = ['low', 'medium', 'high', 'ultra'];
        const currentIndex = levels.indexOf(this.performance.qualityLevel);
        
        if (currentIndex > 0) {
            this.performance.qualityLevel = levels[currentIndex - 1];
            this.applyQualitySettings();
            console.log(`Quality decreased to: ${this.performance.qualityLevel}`);
        }
    }
    
    /**
     * Increase rendering quality
     */
    increaseQuality() {
        const levels = ['low', 'medium', 'high', 'ultra'];
        const currentIndex = levels.indexOf(this.performance.qualityLevel);
        
        if (currentIndex < levels.length - 1) {
            this.performance.qualityLevel = levels[currentIndex + 1];
            this.applyQualitySettings();
            console.log(`Quality increased to: ${this.performance.qualityLevel}`);
        }
    }
    
    /**
     * Apply quality settings
     */
    applyQualitySettings() {
        const settings = {
            low: {
                RENDER_DISTANCE: 3,
                ENABLE_SHADOWS: false,
                ENABLE_PARTICLES: false,
                MAX_DRAW_CALLS: 50
            },
            medium: {
                RENDER_DISTANCE: 5,
                ENABLE_SHADOWS: false,
                ENABLE_PARTICLES: true,
                MAX_DRAW_CALLS: 75
            },
            high: {
                RENDER_DISTANCE: 8,
                ENABLE_SHADOWS: true,
                ENABLE_PARTICLES: true,
                MAX_DRAW_CALLS: 100
            },
            ultra: {
                RENDER_DISTANCE: 12,
                ENABLE_SHADOWS: true,
                ENABLE_PARTICLES: true,
                MAX_DRAW_CALLS: 150
            }
        };
        
        const qualitySettings = settings[this.performance.qualityLevel];
        Object.assign(this.config, qualitySettings);
        
        // Apply settings to engine and world
        if (this.engine) {
            this.engine.updateConfig(this.config);
        }
        if (this.world) {
            this.world.updateConfig(this.config);
        }
    }
    
    /**
     * Pause the game
     */
    pause() {
        this.isPaused = true;
        console.log('Game paused');
    }
    
    /**
     * Resume the game
     */
    resume() {
        this.isPaused = false;
        this.lastTime = performance.now();
        console.log('Game resumed');
    }
    
    /**
     * Stop the game
     */
    stop() {
        this.isRunning = false;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Cleanup resources
        if (this.engine) {
            this.engine.destroy();
        }
        if (this.world) {
            this.world.destroy();
        }
        if (this.touchControls) {
            this.touchControls.destroy();
        }
        
        console.log('Game stopped');
    }
    
    /**
     * Update loading progress
     */
    updateLoadingProgress(percent, message) {
        const progressBar = document.getElementById('loadingProgress');
        const loadingText = document.getElementById('loadingText');
        
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
        if (loadingText) {
            loadingText.textContent = message;
        }
    }
    
    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = `Error: ${message}`;
            loadingText.style.color = '#f44336';
        }
    }
}

// Initialize game when DOM is ready
async function initGame() {
    try {
        // Load all modules first
        console.log('Loading game modules...');
        const modules = await loadModules();
        
        // Create game instance
        console.log('Creating game instance...');
        window.game = new VoxelGame(modules);
        
        // Initialize game
        console.log('Initializing game...');
        await window.game.init();
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
        
        // Show error on loading screen
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = `Error: ${error.message}`;
            loadingText.style.color = '#f44336';
        }
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// Export for module usage
export { VoxelGame, CONFIG };