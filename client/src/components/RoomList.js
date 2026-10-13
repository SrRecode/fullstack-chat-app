import React from 'react';

function RoomList({ rooms, currentRoom, onSwitchRoom }) {
  return (
    <div className="room-list">
      <div className="room-list-header">
        <span>Rooms</span>
      </div>
      <div className="rooms">
        {rooms.map((room) => (
          <button
            key={room.name}
            className={`room-item ${currentRoom === room.name ? 'active' : ''}`}
            onClick={() => onSwitchRoom(room.name)}
          >
            <span className="room-hash">#</span>
            <span className="room-name">{room.name}</span>
            {room.userCount > 0 && (
              <span className="room-badge">{room.userCount}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default RoomList;
