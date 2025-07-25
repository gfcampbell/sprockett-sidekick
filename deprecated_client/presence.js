// client/presence.js
// Presence tracking for Oblivn host availability
// Handles upserts to user_presence table

import { supabase } from './supabaseClient.js';

/**
 * Updates presence status for a host
 * @param {string} hostId - Host identifier 
 * @param {boolean} isAvailable - Whether host is available for calls
 * @param {string} roomId - Room ID where host is available
 * @returns {Promise<boolean>} Success status
 */
export const updatePresence = async (hostId, isAvailable, roomId = null) => {
    console.log(`🔄 Updating presence - Host: ${hostId}, Available: ${isAvailable}, Room: ${roomId}`);
    
    if (!supabase) {
        console.warn('⚠️ Supabase not available - skipping presence update');
        return false;
    }

    try {
        const presenceData = {
            host_id: hostId,
            is_available: isAvailable,
            room_id: roomId,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('user_presence')
            .upsert(presenceData, { 
                onConflict: 'host_id',
                ignoreDuplicates: false 
            })
            .select();

        if (error) {
            console.error('❌ Failed to update presence:', error);
            return false;
        }

        console.log('✅ Presence updated successfully:', data);
        return true;

    } catch (error) {
        console.error('❌ Error updating presence:', error);
        return false;
    }
}; 