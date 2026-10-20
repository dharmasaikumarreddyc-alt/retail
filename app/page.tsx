import type { Metadata } from 'next';
import Header from './components/Header';
import Footer from './components/Footer';
import Preloader from './components/Preloader';
import PopularProducts from './components/PopularProducts';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Agentic AI Checkout | Home',
  description: 'Experience the future of local shopping with AI-powered product discovery and automated checkout. Connect with local merchants, discover fresh products, and enjoy seamless AI-driven purchasing.',
};

export default function Home() {
  return (
    <div className="page-wraper">
      <Preloader />

      <Header />

      <div className="page-content bg-light" style={{ paddingTop: '0' }}>


		{/* Swiper Banner Start */}
		<div className="main-slider style-2" style={{ paddingTop: '0', marginTop: '0' }}>
			<div className="main-swiper2">
				<div className="container">
					<div className="banner-content">
						<div className="row">
							<div className="col-xl-7 col-lg-7 col-md-12 align-self-center">
								<div className="swiper-content">
									<div className="content-info">
										<h1 className="offer-title mb-0" data-swiper-parallax="-20">Your AI-Powered <span className="text-primary d-flex align-items-center"><svg className="m-r10" xmlns="http://www.w3.org/2000/svg" width="68" height="68" viewBox="0 0 68 68" fill="none">
											<path d="M34 0L43.6167 24.3833L68 34L43.6167 43.6167L34 68L24.3833 43.6167L0 34L24.3833 24.3833L34 0Z" fill="var(--primary)"/>
										  </svg>Marketplace</span>for Everyday Shopping.</h1>
										<p className="sub-title mb-0" data-swiper-parallax="-40">Smart AI agents find the best from <span>local merchants</span> near you!</p>												
									</div>
									<div className="content-btn" data-swiper-parallax="-60">
										<Link className="btn btn-secondary me-3" href="/login">GET STARTED</Link>
										<Link className="btn btn-outline-secondary" href="/shop">SHOP NOW</Link>
									</div>
								</div>
							</div>
							<div className="col-xl-5 col-lg-5 col-md-12">
								<div className="banner-media">
									<div className="shap"></div>
									<div className="border-shap"></div>
									<div className="border-shap2"></div>

									<div className="img-preview" data-swiper-parallax="-100">
										<Image src="/images/main-slider/slider2/coffee-splash.png" alt="Coffee cup with a splash of coffee and floating coffee beans" width={5302} height={6600} sizes="(max-width: 991px) 90vw, 470px" loading="eager" fetchPriority="high" />
									</div>
									<div className="bnr-content-bx slideskew">
										<div className="dz-media">
											<img src="/images/shop/product/small/1.png" alt="" />
										</div>
										<div className="dz-info">
											<h5 className="dz-title">Fresh Organic Coffee</h5>
											<h6 className="price text-primary">$80</h6>
											<div className="btn btn-primary meta-icon dz-carticon">
												<i className="flaticon flaticon-basket"></i>
												<i className="flaticon flaticon-basket-on dz-heart-fill"></i>
											</div>
										</div>
									</div>
									<ul className="star-list">
										<li className="star-1">
											<svg xmlns="http://www.w3.org/2000/svg" width="57" height="57" viewBox="0 0 57 57" fill="none">
												<path d="M28.5 0L33.3366 23.6634L57 28.5L33.3366 33.3366L28.5 57L23.6634 33.3366L0 28.5L23.6634 23.6634L28.5 0Z" fill="var(--rgba-primary-2)"/>
											</svg>
										</li>
										<li className="star-2">
											<svg xmlns="http://www.w3.org/2000/svg" width="57" height="57" viewBox="0 0 57 57" fill="none">
												<path d="M28.5 0L33.3366 23.6634L57 28.5L33.3366 33.3366L28.5 57L23.6634 33.3366L0 28.5L23.6634 23.6634L28.5 0Z" fill="var(--rgba-primary-2)"/>
											</svg>
										</li>
										<li className="star-3">
											<svg xmlns="http://www.w3.org/2000/svg" width="57" height="57" viewBox="0 0 57 57" fill="none">
												<path d="M28.5 0L33.3366 23.6634L57 28.5L33.3366 33.3366L28.5 57L23.6634 33.3366L0 28.5L23.6634 23.6634L28.5 0Z" fill="var(--rgba-primary-2)"/>
											</svg>
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="banner-social-media style-2 left">
					<ul>
						<li>
							<a href="https://www.instagram.com/dexignzone/" target="_blank">Instagram</a>
						</li>
						<li>
							<a href="https://www.facebook.com/dexignzone" target="_blank">Facebook</a>
						</li>
						<li>
							<a href="https://twitter.com/dexignzones" target="_blank">twitter</a>
						</li>
					</ul>
				</div>
				<a href="#" className="service-btn btn-dark">Let's talk</a>
			</div>
		</div>		
		{/* Swiper Banner End */}

		{/* Featured Section Start */}
		<div className="content-inner category-section">
			<div className="container">
				<div className="row gx-xl-4 g-3">
					<div className="col-xl-4 col-lg-4 col-md-4 col-6 wow fadeInUp" data-wow-delay="0.2s">
						<div className="category-product left product-1">
							<Link href="/shop">								
								<img src="/images/category/pic1.jpg" alt="" />
								<div className="category-badge">Coffee & Beverages</div>
							</Link>
						</div>
					</div>
					<div className="col-xl-3 col-lg-4 col-md-4 col-6 wow fadeInUp" data-wow-delay="0.3s">
						<div className="category-product left product-2">
							<Link href="/shop">
								<img src="/images/category/pic2.jpg" alt="" />
								<div className="category-badge">Fresh Produce</div>
							</Link>
						</div>
					</div>
					<div className="col-xl-5 col-lg-4 col-md-4 col-6 wow fadeInUp" data-wow-delay="0.4s">
						<div className="category-product left product-3">
							<Link href="/shop">
								<img src="/images/category/pic3.jpg" alt="" />
								<div className="category-badge">Bakery & Pastries</div>
							</Link>
						</div>
					</div>
					<div className="col-xl-4 col-lg-4 col-md-4 col-6 wow fadeInUp" data-wow-delay="0.5s">
						<div className="category-product right product-4">
							<Link href="/shop">
								<img src="/images/category/pic4.jpg" alt="" />
								<div className="category-badge">Groceries</div>
							</Link>
						</div>
					</div>
					<div className="col-xl-5 col-lg-4 col-md-4 col-6 wow fadeInUp" data-wow-delay="0.6s">
						<div className="category-product right product-5">
							<Link href="/shop">
								<img src="/images/category/pic5.jpg" alt="" />
								<div className="category-badge">Breakfast Essentials</div>
							</Link>	
						</div>
					</div>
					<div className="col-xl-3 col-lg-4 col-md-4 col-6 wow fadeInUp" data-wow-delay="0.7s">
						<div className="category-product right product-6">
							<Link href="/shop">
								<img src="/images/category/pic6.jpg" alt="" />
								<div className="category-badge">Local Specialties</div>
							</Link>	
						</div>
					</div>
				</div>
			</div>
			<a className="icon-button" href="shop-with-category.html">
				<div className="text-row word-rotate-box c-black border-white">
					<span className="word-rotate">category - category -</span>
					<svg className="badge__emoji" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
						<g clipPath="url(#clip0_161_568)">
						  <path d="M10.7239 31.3072L19.0059 39.5891C19.2696 39.8523 19.627 40.0001 19.9995 40.0001C20.3721 40.0001 20.7295 39.8523 20.9932 39.5891L29.2752 31.3072C29.4582 31.1236 29.5608 30.8748 29.5606 30.6156C29.5604 30.3564 29.4573 30.1078 29.274 29.9245C29.0907 29.7412 28.8421 29.6381 28.5829 29.6379C28.3237 29.6377 28.075 29.7404 27.8913 29.9234L20.9781 36.8368V0.978516C20.9781 0.718997 20.875 0.470108 20.6915 0.286601C20.508 0.103093 20.2591 0 19.9995 0C19.74 0 19.4911 0.103093 19.3076 0.286601C19.1241 0.470108 19.021 0.718997 19.021 0.978516V36.8368L12.1077 29.9234C11.9241 29.7404 11.6754 29.6377 11.4162 29.6379C11.1569 29.6381 10.9084 29.7412 10.7251 29.9245C10.5418 30.1078 10.4387 30.3564 10.4385 30.6156C10.4383 30.8748 10.5409 31.1236 10.7239 31.3072Z" fill="#000"/>
						</g>
						<defs>
						  <clipPath id="clip0_161_568">
							<rect width="40" height="40" fill="#000"/>
						  </clipPath>
						</defs>
					</svg>
				</div>
			</a>
		</div>	
		{/* Featured Section End */}
		

		<section className="video-section">
			<div className="video-wrapper bg-parallax" style={{backgroundImage: "url('/images/background/bg2.jpg')"}}>
				<div className="container">
					<div className="d-flex justify-content-center">
						<a className="icon-button" href="#">
							<div className="text-row word-rotate-box border-white c-black">
								<span className="word-rotate">shop - shop - shop - shop -</span>
								<svg className="badge__emoji" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
									<g clipPath="url(#clip0_671_345)">
									  <path d="M34.6779 15.3843L11.0529 0.821429C9.34369 -0.230839 7.2772 -0.274589 5.52493 0.704398C3.77266 1.68323 2.72656 3.46612 2.72656 5.47323V34.4664C2.72656 37.5013 5.17188 39.9835 8.17735 39.9999C8.18556 39.9999 8.19376 40 8.20181 40C9.14103 39.9999 10.1198 39.7056 11.0339 39.1478C11.7693 38.6991 12.0017 37.7392 11.5531 37.0039C11.1044 36.2685 10.1444 36.0361 9.40923 36.4848C8.98165 36.7456 8.56407 36.8805 8.19415 36.8804C7.06016 36.8742 5.84602 35.9028 5.84602 34.4665V5.47331C5.84602 4.6123 6.29477 3.84769 7.04634 3.42776C7.79798 3.00784 8.68431 3.02659 9.41658 3.47745L33.0417 18.0404C33.7518 18.4776 34.1581 19.2065 34.1564 20.0405C34.1547 20.8743 33.7454 21.6016 33.0314 22.0373L15.9503 32.4958C15.2156 32.9456 14.9847 33.9059 15.4346 34.6405C15.8843 35.3752 16.8446 35.6061 17.5792 35.1563L34.6583 24.6991C36.2935 23.7015 37.2721 21.9624 37.276 20.0467C37.2799 18.1312 36.3083 16.3881 34.6779 15.3843Z" fill="#FEEB9D"/>
									</g>
									<defs>
									  <clipPath id="clip0_671_345">
										<rect width="40" height="40" fill="white"/>
									  </clipPath>
									</defs>
								</svg>
							</div>
						</a>
					</div>
				</div>
			</div>
			<div className="dz-features-wrapper overflow-hidden">
				<ul className="dz-features text-wrapper">
					<li className="item">
						<h2 className="title">Coffee</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
					<li className="item">
						<h2 className="title">Produce</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
					<li className="item">
						<h2 className="title">Bakery</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
					<li className="item">
						<h2 className="title">Groceries</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
						<li className="item">
						<h2 className="title">Breakfast</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
					<li className="item">
						<h2 className="title">Local Foods</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
					<li className="item">
						<h2 className="title">Coffee</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
					<li className="item">
						<h2 className="title">Produce</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
					<li className="item">
						<h2 className="title">Bakery</h2>
					</li>
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
					<li className="item">
						<h2 className="title">Groceries</h2>
					</li>	
					<li className="item">
						<svg xmlns="http://www.w3.org/2000/svg" width="61" height="60" viewBox="0 0 61 60" fill="none">
						  <path opacity="0.3" d="M29.302 -0.00499268L38.533 21.2005L60.3307 28.9297L39.1253 38.1607L31.396 59.9585L22.165 38.753L0.367297 31.0237L21.5728 21.7928L29.302 -0.00499268Z" fill="black"/>
						</svg>
					</li>
				</ul>
			</div>
		</section>

		{/* Products  Section Start */}
		<section className="content-inner">
			<div className="container">
				<div className=" row justify-content-md-between align-items-start">
					<div className="col-lg-6 col-md-12">
						<div className="section-head style-1 m-b30  wow fadeInUp" data-wow-delay="0.2s">
							<div className="left-content">
								<h2 className="title">Most popular from local merchants</h2>
							</div>
						</div>	
					</div>
					<div className="col-lg-6 col-md-12">
						<div className="site-filters clearfix style-1 align-items-center wow fadeInUp ms-lg-auto" data-wow-delay="0.4s">
							<ul className="filters" data-bs-toggle="buttons">
								<li className="btn active">
									<input type="radio" />
									<a href="#">ALL</a>
								</li>
								<li data-filter=".Dresses" className="btn">
									<input type="radio" />
									<a href="#">Coffee</a>
								</li>
								<li data-filter=".Tops" className="btn">
									<input type="radio" />
									<a href="#">Bakery</a>
								</li>
								<li data-filter=".Outerwear" className="btn">
									<input type="radio" />
									<a href="#">Groceries</a>
								</li>
								<li data-filter=".Jacket" className="btn">
									<input type="radio" />
									<a href="#">Fresh Produce</a>
								</li>
							</ul>
						</div>
					</div>
				</div>
				<PopularProducts />
			</div>
		</section>
		{/* Products Section Start */}
		
		<section className="content-inner-3 companies-section overflow-hidden">
			<div className="container">
				<div className="row justify-content-between align-items-end">
					<div className="col-lg-8 col-md-8 col-sm-12">
						<div className="section-head style-2 wow fadeInUp m-0" data-wow-delay="0.1s">
							<h2 className="title text-white">We're growing with 6.3k trusted local merchants</h2>
						</div>
					</div>
					<div className="col-lg-4 col-md-4 col-sm-12 text-md-center m-b30 wow fadeInUp" data-wow-delay="0.2s">	
						<a className="icon-button d-md-inline-block d-none" href="blog-tag.html">
							<div className="text-row word-rotate-box c-black border-secondary bg-secondary">
								<span className="word-rotate">partner - partner - </span>
								<svg className="badge__emoji" xmlns="http://www.w3.org/2000/svg" width="86" height="86" viewBox="0 0 86 86" fill="none">
									<path d="M85.9974 27.7066L78.4547 15.2934L50.56 30.5869V0H35.44V30.5869L7.54534 15.2934L0 27.7066L27.9018 43L0.00212688 58.2934L7.5451 70.7066L35.44 55.4131V86H50.56V55.4131L78.4544 70.7066L86 58.2934L58.0982 43L85.9974 27.7066Z" fill="#FAFAF8"/>
								</svg>
							</div>
						</a>
					</div>	
				</div>
			</div>	

			<div className="container-fluid">
				<div className="tag-slider style-1 wow fadeInUp" data-wow-delay="0.2s" id="tagSlider">
					<div className="item-wrap">	
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo1.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo2.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo3.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo4.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo5.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo6.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo7.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo8.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo1.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo2.png" alt="" /> 
								</div>
							</a>
						</div>
					</div>
				</div>
				<div className="tag-slider wow fadeInUp" data-wow-delay="0.4s" id="tagSlider2">
					<div className="item-wrap">	
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo1.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo2.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo3.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo4.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo5.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo6.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo7.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo8.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo1.png" alt="" /> 
								</div>
							</a>
						</div>
						<div className="item">
							<a href="#" className="companies-wrapper">
								<div className="companies-media">
									<img src="/images/companies/logo2.png" alt="" /> 
								</div>
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>	
		
		{/* Feature Box End */}
	
      </div>
      
      <Footer />
      
      <button className="scroltop" type="button"><i className="fas fa-arrow-up"></i></button>
    </div>
  );
}
