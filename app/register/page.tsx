import type { Metadata } from 'next';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Preloader from '../components/Preloader';
import Link from 'next/link';
import RegisterClient from './RegisterClient';

export const metadata: Metadata = {
  title: 'Agentic AI Checkout | Create Account',
  description: 'Create an Agentic AI Checkout account',
};

export default function RegisterPage() {
  return (
    <div className="page-wraper">
      <Preloader />

      <Header />

      <div className="page-content bg-light">
        <section className="px-3">
          <div className="row">
            <div className="col-xxl-6 col-xl-6 col-lg-6 start-side-content">
              <div className="dz-bnr-inr-entry">
                <h1>Create Account</h1>
                <nav aria-label="breadcrumb text-align-start" className="breadcrumb-row">
                  <ul className="breadcrumb">
                    <li className="breadcrumb-item"><Link href="/">Home</Link></li>
                    <li className="breadcrumb-item">Register</li>
                  </ul>
                </nav>
              </div>
              <div className="registration-media">
                <img src="/images/registration/pic3.png" alt="" />
              </div>
            </div>
            <div className="col-xxl-6 col-xl-6 col-lg-6 end-side-content justify-content-center">
              <RegisterClient />
            </div>
          </div>
        </section>
      </div>

      <Footer />

      <button className="scroltop" type="button">
        <i className="fas fa-arrow-up"></i>
      </button>
    </div>
  );
}
