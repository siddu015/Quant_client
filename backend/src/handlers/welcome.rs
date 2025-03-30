use actix_web::{HttpResponse, Responder};

pub async fn welcome() -> impl Responder {
    HttpResponse::Ok().body("Welcome to Quantum Email Backend!")
}
