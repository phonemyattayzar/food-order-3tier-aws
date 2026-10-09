from sqlalchemy.orm import Session

from app.models.support_ticket import SupportTicket


def create_support_ticket(db: Session, *, user_id, subject: str, message: str) -> SupportTicket:
    ticket = SupportTicket(user_id=user_id, subject=subject, message=message)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def list_support_tickets_for_user(db: Session, *, user_id) -> list[SupportTicket]:
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == user_id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
