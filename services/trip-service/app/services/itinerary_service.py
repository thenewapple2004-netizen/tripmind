"""
Itinerary planning: building the day-by-day view, detecting scheduling conflicts and applying
drag-and-drop rearrangements.

Key ideas
---------
* Within a day, activities with a start time come first, ordered by that time; activities with no
  start time follow, in their manual `position` order. Dragging therefore only changes the order of
  untimed items and which day an item belongs to; a timed item is moved by editing its time.
* Two timed activities on the same day *conflict* when their time intervals overlap:
  ``a.start < b.end and b.start < a.end`` (touching end-to-start is fine). An activity with a start
  time but no duration is assumed to take `DEFAULT_DURATION_MINUTES` for this check.
* Rearranging is one atomic request (a list of moves), so a drop can never leave a day half-updated.
"""

from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, Iterable, List, Sequence, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.models.schemas import (
    ActivityMove,
    ActivityResponse,
    ItineraryConflict,
    ItineraryDay,
    ItineraryResponse,
)
from app.models.trip import Trip

DEFAULT_DURATION_MINUTES = 60
MAX_DAYS_SHOWN = 366  # a trip spanning years doesn't produce thousands of empty days


def _start_minutes(activity: Activity) -> int:
    return activity.start_time.hour * 60 + activity.start_time.minute


def _end_minutes(activity: Activity) -> int:
    return _start_minutes(activity) + (activity.duration_minutes or DEFAULT_DURATION_MINUTES)


def sort_day(activities: Iterable[Activity]) -> List[Activity]:
    """Timed activities by start time, then untimed ones by manual position."""
    return sorted(
        activities,
        key=lambda a: (
            a.start_time is None,
            _start_minutes(a) if a.start_time is not None else 0,
            a.position or 0,
            str(a.id),
        ),
    )


def find_conflicts(activities: Sequence[Activity]) -> List[ItineraryConflict]:
    """Every pair of overlapping timed activities on the same day."""
    by_day: Dict[date, List[Activity]] = defaultdict(list)
    for a in activities:
        if a.start_time is not None:
            by_day[a.activity_date].append(a)

    conflicts: List[ItineraryConflict] = []
    for day in sorted(by_day):
        timed = sorted(by_day[day], key=lambda a: (_start_minutes(a), str(a.id)))
        for i, first in enumerate(timed):
            for second in timed[i + 1:]:
                if _start_minutes(second) >= _end_minutes(first):
                    break  # sorted by start: nothing later can overlap `first` either
                overlap = min(_end_minutes(first), _end_minutes(second)) - _start_minutes(second)
                conflicts.append(
                    ItineraryConflict(
                        activity_date=day,
                        activity_ids=[first.id, second.id],
                        overlap_minutes=overlap,
                    )
                )
    return conflicts


def build_itinerary(trip: Trip, activities: Sequence[Activity]) -> ItineraryResponse:
    by_day: Dict[date, List[Activity]] = defaultdict(list)
    for a in activities:
        by_day[a.activity_date].append(a)

    span = (trip.end_date - trip.start_date).days + 1
    dates = {trip.start_date + timedelta(days=i) for i in range(min(span, MAX_DAYS_SHOWN))}
    dates |= set(by_day)  # never hide an activity, even one outside the shown range

    days: List[ItineraryDay] = []
    for d in sorted(dates):
        ordered = sort_day(by_day.get(d, []))
        days.append(
            ItineraryDay(
                date=d,
                day_number=(d - trip.start_date).days + 1,
                activities=[ActivityResponse.model_validate(a) for a in ordered],
                total_cost=float(sum(float(a.cost or 0) for a in ordered)),
                scheduled_minutes=sum(a.duration_minutes or 0 for a in ordered),
            )
        )

    return ItineraryResponse(
        trip_id=trip.id,
        start_date=trip.start_date,
        end_date=trip.end_date,
        total_activities=len(activities),
        unscheduled_count=sum(1 for a in activities if a.start_time is None),
        days=days,
        conflicts=find_conflicts(activities),
    )


def apply_moves(db: Session, trip: Trip, activities: Sequence[Activity], moves: Sequence[ActivityMove]) -> None:
    """Applies a drag-and-drop result to the trip's activities (caller commits).

    Validates everything first so an invalid request changes nothing, then re-numbers the positions
    of every affected day 0..n so they stay tidy no matter what numbers the client sent.
    """
    by_id: Dict[UUID, Activity] = {a.id: a for a in activities}
    for move in moves:
        if move.id not in by_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Activity with id '{move.id}' not found for this trip",
            )
        if not (trip.start_date <= move.activity_date <= trip.end_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Activity date {move.activity_date} must be between trip start date "
                    f"({trip.start_date}) and end date ({trip.end_date})"
                ),
            )

    requested: Dict[UUID, Tuple[date, int]] = {m.id: (m.activity_date, m.position) for m in moves}
    affected_days = {by_id[i].activity_date for i in requested} | {d for d, _ in requested.values()}

    for activity_id, (new_date, new_position) in requested.items():
        by_id[activity_id].activity_date = new_date
        by_id[activity_id].position = new_position

    for day in affected_days:
        on_day = [a for a in activities if a.activity_date == day]
        for index, activity in enumerate(sorted(on_day, key=lambda a: (a.position or 0, str(a.id)))):
            activity.position = index
