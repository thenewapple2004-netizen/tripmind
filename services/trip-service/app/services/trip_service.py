from typing import Dict, List, Optional
from uuid import UUID, uuid4
from app.models.schemas import TripCreate, TripResponse, TripUpdate


class TripStorage:
    def __init__(self):
        self._trips: Dict[UUID, dict] = {}

    def create(self, trip_in: TripCreate) -> TripResponse:
        trip_id = uuid4()
        trip_data = trip_in.model_dump()
        trip_data["id"] = trip_id
        self._trips[trip_id] = trip_data
        return TripResponse(**trip_data)

    def get_all(self) -> List[TripResponse]:
        return [TripResponse(**trip) for trip in self._trips.values()]

    def get_by_id(self, trip_id: UUID) -> Optional[TripResponse]:
        trip = self._trips.get(trip_id)
        if not trip:
            return None
        return TripResponse(**trip)

    def update(self, trip_id: UUID, trip_in: TripUpdate) -> Optional[TripResponse]:
        trip = self._trips.get(trip_id)
        if not trip:
            return None

        update_data = trip_in.model_dump(exclude_unset=True)
        # Validate date consistency if only one date is updated
        start_date = update_data.get("start_date", trip["start_date"])
        end_date = update_data.get("end_date", trip["end_date"])
        if end_date < start_date:
            raise ValueError("end_date cannot be earlier than start_date")

        trip.update(update_data)
        self._trips[trip_id] = trip
        return TripResponse(**trip)

    def delete(self, trip_id: UUID) -> bool:
        if trip_id in self._trips:
            del self._trips[trip_id]
            return True
        return False


trip_storage = TripStorage()
