/**
 * Voxel Game - Object Pool
 * Memory optimization through object reuse
 * Version: 0.0.1
 */

export class ObjectPool {
    constructor(createFn, resetFn = null, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.active = new Set();
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    /**
     * Get object from pool
     */
    get() {
        let obj;
        
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        
        this.active.add(obj);
        
        if (this.resetFn) {
            this.resetFn(obj);
        }
        
        return obj;
    }
    
    /**
     * Return object to pool
     */
    release(obj) {
        if (this.active.has(obj)) {
            this.active.delete(obj);
            this.pool.push(obj);
        }
    }
    
    /**
     * Clear pool
     */
    clear() {
        this.pool = [];
        this.active.clear();
    }
    
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            pooled: this.pool.length,
            active: this.active.size,
            total: this.pool.length + this.active.size
        };
    }
}