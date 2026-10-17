'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { optionalBackendUrl } from '../lib/backend';
import { clearAuthenticatedToken, getAuthenticatedSession } from '../lib/auth';

export default function Header() {
  const [cartCount, setCartCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const pathname = usePathname();
  const selectInitialized = useRef(false);
  const initTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // Reinitialize bootstrap-select when route changes
    const initializeSelects = () => {
      if (typeof window !== 'undefined' && (window as any).$) {
        const $ = (window as any).$;
        try {
          const $selects = $('.default-select');

          if ($selects.length > 0) {
            if (selectInitialized.current) {
              // Just refresh if already initialized
              $selects.selectpicker('refresh');
            } else {
              // Initialize for the first time
              $selects.selectpicker();
              selectInitialized.current = true;
            }
          }
        } catch (e) {
          // Selectpicker not ready yet, ignore
          console.debug('Selectpicker initialization skipped:', e);
        }
      }
    };

    // Clear any existing timer
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current);
    }

    // Delay initialization to ensure DOM is ready
    initTimerRef.current = setTimeout(initializeSelects, 150);

    return () => {
      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current);
      }
    };
  }, [pathname]);

  const checkAuthStatus = async () => {
    const session = await getAuthenticatedSession('customer');
    setIsLoggedIn(Boolean(session));
    setUserName(session?.profile.name || session?.profile.email || '');
  };

  const handleLogout = () => {
    clearAuthenticatedToken('customer');
    setIsLoggedIn(false);
    setUserName('');
    setCartCount(0);
    setShowProfileDropdown(false);
    window.dispatchEvent(new Event('authChanged'));
    window.location.href = '/';
  };

  const fetchCartCount = async () => {
    const backend = optionalBackendUrl;
    if (!backend) {
      setCartCount(0);
      return;
    }
    try {
      const session = await getAuthenticatedSession('customer');
      if (!session) {
        setCartCount(0);
        return;
      }

      const response = await fetch(`${backend}/cart`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCartCount(data.count || 0);
      } else {
        setCartCount(0);
      }
    } catch {
      // Backend (localhost:8000) not running — non-critical, degrade silently.
      setCartCount(0);
    }
  };

  useEffect(() => {
    checkAuthStatus();
    fetchCartCount();

    const handleCartUpdate = () => {
      fetchCartCount();
    };
    const handleAuthChange = () => {
      checkAuthStatus();
      fetchCartCount();
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    window.addEventListener('authChanged', handleAuthChange);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
      window.removeEventListener('authChanged', handleAuthChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
<header className="site-header mo-left header style-2" style={{ marginBottom: '0', paddingBottom: '0' }}>
		{/* Main Header — top info bar removed per design (logo kept in main bar below) */}
		<div className="header-info-bar" style={{ display: 'none' }}>
			<div className="container clearfix">
				{/* Website Logo */}
				<div className="logo-header logo-dark">
					<Link href="/"><img src="/images/logo.svg" alt="logo" /></Link>
				</div>
				
				{/* EXTRA NAV */}
				<div className="extra-nav d-md-flex d-none m-l15">
					<div className="extra-cell">
						<ul className="navbar-nav header-right m-0">
							<li className="nav-item info-box ">
								<div className="nav-link">
									<div className="dz-icon">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" xmlSpace="preserve"><path style={{fill:'#3cc'}} d="M489.343 210.251c-4.827-105.317-92.01-189.513-198.498-189.513h-69.689c-106.488 0-193.67 84.197-198.498 189.513C9.495 214.747 0 227.228 0 241.894v78.61c0 18.436 15 33.436 33.437 33.436h60.996c6.075 0 11-4.925 11-11V219.458c0-6.075-4.925-11-11-11H44.789c5.699-92.338 82.618-165.72 176.366-165.72h69.689c93.749 0 170.667 73.381 176.366 165.72h-49.644c-6.075 0-11 4.925-11 11V342.94c0 6.075 4.925 11 11 11h60.996c18.436 0 33.436-15 33.436-33.436v-78.61c.002-14.666-9.493-27.147-22.655-31.643zM83.433 331.94H33.437c-6.306 0-11.437-5.13-11.437-11.436v-78.61c0-6.306 5.131-11.436 11.437-11.436h49.996V331.94zM490 320.504c0 6.306-5.131 11.436-11.436 11.436h-49.996V230.458h49.996c6.306 0 11.436 5.13 11.436 11.436v78.61z"/><path d="M256 491.262a11.001 11.001 0 0 1-8.402-3.9l-52.108-61.671h-74.566c-20.673 0-37.491-16.818-37.491-37.49V188.049c0-20.673 16.818-37.491 37.491-37.491h270.154c20.672 0 37.49 16.818 37.49 37.491V388.2c0 20.672-16.818 37.49-37.49 37.49h-74.566l-52.108 61.671a11.006 11.006 0 0 1-8.404 3.901zM120.923 172.558c-8.542 0-15.491 6.949-15.491 15.491V388.2c0 8.541 6.949 15.49 15.491 15.49h79.673c3.238 0 6.312 1.427 8.402 3.9L256 463.218l47.002-55.627a10.998 10.998 0 0 1 8.402-3.9h79.673c8.541 0 15.49-6.949 15.49-15.49V188.049c0-8.542-6.949-15.491-15.49-15.491H120.923z"/><path d="M193.81 259.09c-8.663.084-14.039-9.956-9.139-17.11 4.134-6.475 14.16-6.434 18.29 0 4.892 7.164-.483 17.196-9.151 17.11zM311.729 259.09c-7.629.166-13.258-8.219-10.16-15.21 3.614-8.972 16.705-8.978 20.31 0 3.113 6.979-2.526 15.376-10.15 15.21zM256 352.204c-25.31 0-50.619-10.009-73.192-30.028-4.545-4.03-4.962-10.982-.931-15.528 4.029-4.545 10.982-4.962 15.528-.931 36.689 32.536 80.501 32.538 117.19 0 4.547-4.031 11.497-3.614 15.528.931 4.031 4.546 3.614 11.498-.931 15.528-22.572 20.019-47.882 30.028-73.192 30.028z"/></svg>
									</div>
									<div className="info-content">
										<span>24/7 SUPPORT</span>
										<h6 className="title mb-0">+123 456 789</h6>
									</div>
								</div>
							</li>
						</ul>
					</div>
				</div>
				
				{/* header search nav */}
				<div className="header-search-nav">
					<form className="header-item-search" action="/shop" method="get">
						<div className="input-group search-input">
							<select name="category" className="default-select" style={{ minWidth: '150px' }}>
    <option value="">All Food &amp; Drinks</option>
    <option value="Breakfast">Breakfast</option>
    <option value="Drinks">Drinks</option>
    <option value="Bakery">Bakery</option>
    <option value="Lunch">Lunch</option>
</select>
							<input name="search" type="search" className="form-control" aria-label="Search food and drinks" placeholder="Search food and drinks" />
							<button className="btn" type="submit" aria-label="Search">
								<i className="iconly-Light-Search text-secondary"></i>
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
		{/* Main Header End */}
		
		{/* Main Header */}
		<div className="sticky-header main-bar-wraper navbar-expand-lg">
			<div className="main-bar clearfix">
				<div className="container clearfix d-lg-flex d-block">
					{/* Website Logo */}
					<div className="logo-header logo-dark">
						<Link href="/"><img src="/images/logo.svg" alt="logo" /></Link>
					</div>
					
					{/* Nav Toggle Button */}
					<button className="navbar-toggler collapsed navicon justify-content-end" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
						<span></span>
						<span></span>
						<span></span>
					</button>
					
					{/* Main Nav */}
					<div className="header-nav w3menu navbar-collapse collapse justify-content-start" id="navbarNavDropdown">
						<div className="logo-header">
							<Link href="/"><img src="/images/logo.svg" alt="" /></Link>
						</div>
                        <div className="browse-category-menu">
                            <a href="#" className="category-btn">
                                <div className="category-menu me-3"><span></span><span></span><span></span></div>
                                <span className="category-btn-title">Browse Food &amp; Drinks</span>
                                <span className="toggle-arrow ms-auto"><i className="icon feather icon-chevron-down"></i></span>
                            </a>
                            <div className="category-menu-items" style={{display: 'none'}}>
                                <ul className="nav navbar-nav">
                                    <li><Link href="/shop?category=Breakfast">Breakfast</Link></li>
                                    <li><Link href="/shop?category=Drinks">Drinks</Link></li>
                                    <li><Link href="/shop?category=Bakery">Bakery</Link></li>
                                    <li><Link href="/shop?category=Lunch">Lunch</Link></li>
                                </ul>
                            </div>
                        </div>
						<ul className="nav navbar-nav">
							<li className="has-mega-menu sub-menu-down auto-width menu-left">
								<a href="#"><span>Home</span><i className="fas fa-chevron-down tabindex" ></i></a>
								<div className="mega-menu ">
									<ul className="demo-menu mb-0">
										<li>
											<Link href="/">
												<img src="/images/demo/demo-1.png" alt="/" />
												<span className="menu-title">01 Home Page</span>
											</Link>
										</li>
										<li>
											<Link href="/">
												<img src="/images/demo/demo-2.png" alt="/" />
												<span className="menu-title">02 Home Page</span>
											</Link>
										</li>
										<li>
											<a href="index-3.html">
												<img src="/images/demo/demo-3.png" alt="/" />
												<span className="menu-title">03 Home Page</span>
											</a>
										</li>
									</ul>
								</div>
							</li>
							<li className="has-mega-menu sub-menu-down">
								<a href="#"><span>Shop</span><i className="fas fa-chevron-down tabindex" ></i></a>
								<div className="mega-menu shop-menu">
									<ul>
										<li className="side-left">
											<ul>
												<li><a href="#" className="menu-title">Shop Structure</a>
													<ul>
														<li><Link href="/shop">Shop Standard</Link></li>
														<li><Link href="/shop">Shop List</Link></li>
														<li><a href="shop-with-category.html">Shop With Category</a></li>
														<li><Link href="/shop">Shop Filters Top Bar</Link></li>
														<li><a href="shop-sidebar.html">Shop Sidebar</a></li>
														<li><a href="shop-style-1.html">Shop Style 1</a></li>
														<li><a href="shop-style-2.html">Shop Style 2</a></li>
													</ul>
												</li>
												<li><a href="#" className="menu-title">Product Structure</a>
													<ul>
														<li><a href="product-default.html">Default</a></li>
														<li><a href="product-thumbnail.html">Thumbnail</a></li>
														<li><a href="product-grid-media.html">Grid Media</a></li>
														<li><a href="product-carousel.html">Carousel</a></li>
														<li><a href="product-full-width.html">Full Width</a></li>
													</ul>
												</li>
												<li><a href="#" className="menu-title">Shop Pages</a>
													<ul>						
														<li><a href="shop-wishlist.html">Wishlist</a></li>
														<li><Link href="/cart">Cart</Link></li>
														<li><Link href="/checkout">Checkout</Link></li>
														<li><a href="shop-compare.html">Compare</a></li>
														<li><a href="shop-order-tracking.html">Order Tracking</a></li>
														<li><Link href="/login">Login</Link></li>
														<li><a href="registration.html">Registration</a></li>
													<li><a href="forget-password.html">Forget Password </a></li>
													</ul>
												</li>
												<li className="month-deal">
													<div className="clearfix me-3">
														<h3>Deal of the month</h3>
														<p className="mb-0">Yes! Send me exclusive offers, personalised, and unique gift ideas, tips for shopping on Pixio <Link href="/shop" className="dz-link-2">View All Products</Link></p>
													</div>
													<div className="sale-countdown">
														<div className="countdown text-center">
															<div className="date">
																<span className="time days text-primary"></span>
																<span className="work-time">Days</span>
															</div>
															<div className="date">
																<span className="time hours text-primary"></span>
																<span className="work-time">Hours</span>
															</div>
															<div className="date">
																<span className="time mins text-primary"></span>
																<span className="work-time">Minutess</span>
															</div>
															<div className="date">
																<span className="time secs text-primary"></span>
																<span className="work-time">Second</span>
															</div>
														</div>
													</div>
												</li>
											</ul>
										</li>
										<li className="side-right">
											<div className="adv-media">
												<img src="/images/adv-1.png" alt="/" />
											</div>
										</li>
									</ul>
								</div>
							</li>
							<li className="has-mega-menu sub-menu-down auto-width">
								<a href="#"><span>Blog</span><i className="fas fa-chevron-down tabindex"></i></a>
								<div className="mega-menu">
									<ul>
										<li>
											<a href="#" className="menu-title">Blog Dark Style</a>
											<ul>
												<li><a href="blog-dark-2-column.html">Blog 2 Column</a></li>
												<li><a href="blog-dark-2-column-sidebar.html">Blog 2 Column Sidebar</a></li>
												<li><a href="blog-dark-3-column.html">Blog 3 Column</a></li>
												<li><a href="blog-dark-half-image.html">Blog Half Image</a></li>
											</ul>
											<a href="#" className="menu-title">Blog Light Style</a>
											<ul>
												<li><a href="blog-light-2-column.html">Blog 2 Column</a></li>
												<li><a href="blog-light-2-column-sidebar.html">Blog 2 Column Sidebar</a></li>
												<li><a href="blog-light-half-image.html">Blog Half Image</a></li>
												<li><a href="blog-exclusive.html">Blog Exclusive</a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Blog List Sidebar</a>
											<ul>
												<li><a href="blog-list-no-sidebar.html">No Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="blog-list-left-sidebar.html">left Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="blog-list-right-sidebar.html">Right Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="blog-list-both-sidebar.html">Both Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
											</ul>
											<a href="#" className="menu-title">Blog Grid Sidebar</a>
											<ul>
												<li><a href="blog-grid-no-sidebar.html">No Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="blog-grid-left-sidebar.html">left Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="blog-grid-right-sidebar.html">Right Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="blog-grid-both-sidebar.html">Both Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="blog-grid-wide-sidebar.html">Wide Sidebar <div className="badge badge-sm rounded badge-animated">New</div></a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Blog Page</a>
											<ul>
												<li><a href="blog-archive.html">Blog Archive</a></li>
												<li><a href="blog-author.html">Author</a></li>
												<li><a href="blog-category.html">Blog Category</a></li>
												<li><a href="blog-tag.html">Blog Tag</a></li>
											</ul>
										</li>
										<li className="post-menu">
											<a href="#" className="menu-title">Recent Posts</a>
											<div className="widget widget_post pt-2">
												<ul>
													<li>
														<div className="dz-media">
															<img src="/images/shop/product/small/1.png" alt="" />
														</div>
														<div className="dz-content">
															<h6 className="name"><a href="post-standard.html">Cozy Knit Cardigan Sweater</a></h6>
															<span className="time">July 23, 2024</span>
														</div>
													</li>
													<li>
														<div className="dz-media">
															<img src="/images/shop/product/small/2.png" alt="" />
														</div>
														<div className="dz-content">
															<h6 className="name"><a href="post-standard.html">Sophisticated Swagger Suit</a></h6>
															<span className="time">July 23, 2024</span>
														</div>
													</li>
													<li>
														<div className="dz-media">
															<img src="/images/shop/product/small/3.png" alt="" />
														</div>
														<div className="dz-content">
															<h6 className="name"><a href="post-standard.html">Athletic Mesh Sports Leggings</a></h6>
															<span className="time">July 23, 2024</span>
														</div>
													</li>
													<li>
														<div className="dz-media">
															<img src="/images/shop/product/small/4.png" alt="" />
														</div>
														<div className="dz-content">
															<h6 className="name"><a href="post-standard.html">Satin Wrap Party Blouse</a></h6>
															<span className="time">July 23, 2024</span>
														</div>
													</li>
												</ul>
											</div>
										</li>
									</ul>
								</div>
							</li>
							<li className="has-mega-menu sub-menu-down auto-width">
								<a href="#"><span>Post Layout</span><i className="fas fa-chevron-down tabindex"></i></a>
								<div className="mega-menu">
									<ul>
										<li>
											<a href="#" className="menu-title">Post Types</a>
											<ul>
												<li><a href="post-text.html">Text Post <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="post-image.html">Image Post <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="post-video.html">Video Post</a></li>
												<li><a href="post-link.html">Link Post</a></li>
												<li><a href="post-audio.html">Audio Post</a></li>
												<li><a href="post-quote.html">Post Quote</a></li>
												<li><a href="post-tutorial.html">Tutorial Post <div className="badge badge-sm rounded badge-animated">New</div></a></li>
												<li><a href="post-cateloge.html">Cateloge Post <div className="badge badge-sm rounded badge-animated">New</div></a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Multiple Media</a>
											<ul>	
												<li><a href="post-banner.html">Banner</a></li>
												<li><a href="post-slide-show.html">Slider</a></li>
												<li><a href="post-gallery.html">Gallery</a></li>
												<li><a href="post-status.html">Status Slider <div className="badge badge-sm rounded badge-animated">New</div></a></li>
											</ul>
											<a href="#" className="menu-title">Post Layout Type</a>
											<ul>	
												<li><a href="post-standard.html">Standard Post</a></li>
												<li><a href="post-corner.html">Corner Post</a></li>
												<li><a href="post-side.html">Side Post <div className="badge badge-sm rounded badge-animated">New</div></a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Side Bar</a>
											<ul>
												<li><a href="post-left-sidebar.html">Left Sidebar</a></li>
												<li><a href="post-right-sidebar.html">Right Sidebar</a></li>
												<li><a href="post-both-sidebar.html">Both Sidebar</a></li>
												<li><a href="post-no-sidebar.html">No Sidebar</a></li>
											</ul>
										</li>
									</ul>
								</div>
							</li>
							<li className="has-mega-menu sub-menu-down">
								<a href="#"><span>Portfolio</span><i className="fas fa-chevron-down tabindex"></i></a>
								<div className="mega-menu portfolio-menu">
									<ul>
										<li className="side-left">
											<ul className="portfolio-nav-link">
												<li>
													<a href="portfolio-tiles.html">
														<img src="/images/portfolio/icons/portfolio-tiles.svg" alt="/" />
														<span>Portfolio Tiles</span>
													</a>
												</li>
												<li>
													<a href="collage-style-1.html">
														<img src="/images/portfolio/icons/collage-style-1.svg" alt="/" />
														<span>Collage Style 1</span>
													</a>
												</li>
												<li>
													<a href="collage-style-2.html">
														<img src="/images/portfolio/icons/collage-style-2.svg" alt="/" />
														<span>Collage Style 2</span>
													</a>
												</li>
												<li>
													<a href="masonry-grid.html">
														<img src="/images/portfolio/icons/masonry-grid.svg" alt="/" />
														<span>Masonry Grid</span>
													</a>
												</li>
												<li>
													<a href="cobble-style-1.html">
														<img src="/images/portfolio/icons/cobble-style-1.svg" alt="/" />
														<span>Cobble Style 1</span>
													</a>
												</li>
												<li>
													<a href="cobble-style-2.html">
														<img src="/images/portfolio/icons/cobble-style-2.svg" alt="/" />
														<span>Cobble Style 2</span>
													</a>
												</li>
												<li>
													<a href="portfolio-thumbs-slider.html">
														<img src="/images/portfolio/icons/portfolio-thumbs-slider.svg" alt="/" />
														<span>Portfolio Thumbs Slider</span>
													</a>
												</li>
												<li>
													<a href="portfolio-film-strip.html">
														<img src="/images/portfolio/icons/portfolio-film-strip.svg" alt="/" />
														<span>Portfolio Film Strip</span>
													</a>
												</li>
												<li>
													<a href="carousel-showcase.html">
														<img src="/images/portfolio/icons/carousel-showcase.svg" alt="/" />
														<span>Carousel Showcase</span>
													</a>
												</li>
												<li>
													<a href="portfolio-split-slider.html">
														<img src="/images/portfolio/icons/portfolio-split-slider.svg" alt="/" />
														<span>Portfolio Split Slider</span>
													</a>
												</li>
											</ul>
										</li>
										<li className="side-right line-left">
											<a href="#" className="menu-title">Portfolio Details</a>
											<ul>
												<li><a href="portfolio-details-1.html">Portfolio Details 1</a></li>
												<li><a href="portfolio-details-2.html">Portfolio Details 2</a></li>
												<li><a href="portfolio-details-3.html">Portfolio Details 3</a></li>
												<li><a href="portfolio-details-4.html">Portfolio Details 4</a></li>
												<li><a href="portfolio-details-5.html">Portfolio Details 5</a></li>
											</ul>
										</li>
									</ul>
								</div>
							</li>
							<li className="has-mega-menu sub-menu-down wide-width">
								<a href="#"><span>Pages</span><i className="fas fa-chevron-down tabindex"></i></a>
								<div className="mega-menu">
									<ul>
										<li>
											<a href="#" className="menu-title">Pages</a>
											<ul>
												<li><a href="about-us.html">About Us</a></li>
												<li><a href="about-me.html">About Me</a></li>
												<li><a href="pricing-table.html">Pricing Table</a></li>
												<li><a href="our-gift-vouchers.html">Our Gift Vouchers</a></li>
												<li><a href="what-we-do.html">What We Do</a></li>
												<li><a href="faqs-1.html">Faqs 1</a></li>
												<li><a href="faqs-2.html">Faqs 2</a></li>
												<li><a href="our-team.html">Our Team</a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Contact Us</a>
											<ul>
												<li><a href="contact-us-1.html">Contact Us 1</a></li>
												<li><a href="contact-us-2.html">Contact Us 2</a></li>
												<li><a href="contact-us-3.html">Contact Us 3</a></li>
											</ul>
											<a href="#" className="menu-title">Web Pages</a>
											<ul>
												<li><a href="nav-3.html">Error 404 1</a></li>
												<li><a href="error-2.html">Error 404 2</a></li>
												<li><a href="coming-soon.html">Coming Soon</a></li>
												<li><a href="under-construction.html">Under Construction</a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Banner Style</a>
											<ul>						
												<li><a href="banner-with-bg-color.html">Banner with BG Color</a></li>
												<li><a href="banner-with-image.html">Banner with Image</a></li>
												<li><a href="banner-with-video.html">Banner with Video</a></li>
												<li><a href="banner-with-kanbern.html">Banner with Kanbern</a></li>
												<li><a href="banner-small.html">Banner Small</a></li>
												<li><a href="banner-medium.html">Banner Medium</a></li>
												<li><a href="banner-large.html">Banner Large</a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Header Style</a>
											<ul>
												<li><a href="header-style-1.html">Header Style 1</a></li>
												<li><a href="header-style-2.html">Header Style 2</a></li>
												<li><a href="header-style-3.html">Header Style 3</a></li>
												<li><a href="header-style-4.html">Header Style 4</a></li>
												<li><a href="header-style-5.html">Header Style 5</a></li>
												<li><a href="header-style-6.html">Header Style 6</a></li>
												<li><a href="header-style-7.html">Header Style 7</a></li>
												<li className="w3menulink"><a href="w3menu.html">Menu Styles</a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Footer Style</a>
											<ul>
												<li><a href="footer-style-1.html">Footer Style 1</a></li>
												<li><a href="footer-style-2.html">Footer Style 2</a></li>
												<li><a href="footer-style-3.html">Footer Style 3</a></li>
												<li><a href="footer-style-4.html">Footer Style 4</a></li>
												<li><a href="footer-style-5.html">Footer Style 5</a></li>
												<li><a href="footer-style-6.html">Footer Style 6</a></li>
												<li><a href="footer-style-7.html">Footer Style 7</a></li>
											</ul>
										</li>
										<li>
											<a href="#" className="menu-title">Dashboard</a>
											<ul>
												<li><a href="account-dashboard.html">Dashboard</a></li>
												<li><a href="account-orders.html">Orders</a></li>
												<li><a href="account-order-details.html">Orders Details</a></li>
												<li><a href="account-order-confirmation.html">Orders Confirmation</a></li>
												<li><a href="account-downloads.html">Downloads</a></li>
												<li><a href="account-return-request.html">Return Request</a></li>
												<li><a href="account-return-request-detail.html">Return Request Detail</a></li>
												<li><a href="account-refund-requests-confirmed.html">Return Request Confirmed</a></li>
											</ul>
										</li>
									</ul>
								</div>
							</li>
						</ul>
						<div className="dz-social-icon">
							<ul>
								<li><a className="fab fa-facebook-f" target="_blank" href="https://www.facebook.com/dexignzone"></a></li>
								<li><a className="fab fa-twitter" target="_blank" href="https://twitter.com/dexignzones"></a></li>
								<li><a className="fab fa-linkedin-in" target="_blank" href="https://www.linkedin.com/showcase/3686700/admin/"></a></li>
								<li><a className="fab fa-instagram" target="_blank" href="https://www.instagram.com/dexignzone/"></a></li>
							</ul>
						</div>
					</div>

					{/* EXTRA NAV */}
					<div className="extra-nav">
						<div className="extra-cell">
							<ul className="header-right">
								{isLoggedIn ? (
									<li className="nav-item login-link" style={{ position: 'relative' }} ref={dropdownRef}>
										<button
											onClick={() => setShowProfileDropdown(!showProfileDropdown)}
											className="nav-link"
											style={{
												background: 'none',
												border: 'none',
												cursor: 'pointer',
												padding: '0.5rem 1rem',
												display: 'flex',
												alignItems: 'center',
												gap: '0.5rem'
											}}
										>
											<i className="fa fa-user-circle" style={{ fontSize: '1.2rem' }}></i>
											<span style={{ whiteSpace: 'nowrap' }}>{userName}</span>
											<i className={`fa fa-chevron-${showProfileDropdown ? 'up' : 'down'}`} style={{ fontSize: '0.8rem' }}></i>
										</button>
										{showProfileDropdown && (
											<div
												style={{
													position: 'absolute',
													top: '100%',
													right: 0,
													backgroundColor: 'white',
													boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
													borderRadius: '8px',
													minWidth: '200px',
													marginTop: '0.5rem',
													zIndex: 1000,
													overflow: 'hidden'
												}}
											>
												<Link
													href="/account/dashboard"
													className="dropdown-item"
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: '0.75rem',
														padding: '0.75rem 1rem',
														color: '#333',
														textDecoration: 'none',
														transition: 'background-color 0.2s'
													}}
													onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
													onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
													onClick={() => setShowProfileDropdown(false)}
												>
													<i className="fa fa-tachometer"></i>
													<span>Dashboard</span>
												</Link>
												<Link
													href="/account/orders"
													className="dropdown-item"
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: '0.75rem',
														padding: '0.75rem 1rem',
														color: '#333',
														textDecoration: 'none',
														transition: 'background-color 0.2s'
													}}
													onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
													onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
													onClick={() => setShowProfileDropdown(false)}
												>
													<i className="fa fa-list"></i>
													<span>Orders</span>
												</Link>
												<button
													onClick={handleLogout}
													style={{
														width: '100%',
														display: 'flex',
														alignItems: 'center',
														gap: '0.75rem',
														padding: '0.75rem 1rem',
														color: '#333',
														textDecoration: 'none',
														background: 'none',
														border: 'none',
														textAlign: 'left',
														cursor: 'pointer',
														transition: 'background-color 0.2s'
													}}
													onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
													onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
												>
													<i className="fa fa-sign-out"></i>
													<span>Logout</span>
												</button>
											</div>
										)}
									</li>
								) : (
									<li className="nav-item login-link">
										<Link className="nav-link" href="/login" style={{ whiteSpace: 'nowrap' }}>
											Login / Register
										</Link>
									</li>
								)}
								<li className="nav-item search-link">
									<a className="nav-link" href="#" data-bs-toggle="offcanvas" data-bs-target="#offcanvasTop" aria-controls="offcanvasTop">
										<i className="iconly-Light-Search"></i>
									</a>
								</li>
								<li className="nav-item">
									<Link className="nav-link" href="/merchant/login" style={{ whiteSpace: 'nowrap' }} title="Merchant Console">
										<i className="fa fa-store"></i>
									</Link>
								</li>
								<li className="nav-item cart-link">
									<Link href="/cart" className="nav-link cart-btn">
										<i className="iconly-Broken-Buy"></i>
										{cartCount > 0 && <span className="badge badge-circle">{cartCount}</span>}
									</Link>
								</li>
								{isLoggedIn && (
									<li className="nav-item" style={{ marginLeft: '1rem' }}>
										<Link
											href="/cart-pilot"
											className="btn btn-secondary btn-sm"
											style={{
												borderRadius: '25px',
												padding: '0.6rem 1.2rem',
												fontSize: '0.875rem',
												fontWeight: '500',
												whiteSpace: 'nowrap',
												display: 'inline-flex',
												alignItems: 'center',
												gap: '0.5rem'
											}}
										>
											CART PILOT
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '4px' }}>
												<path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z"/>
												<path d="M19 14L20.18 17.82L24 19L20.18 20.18L19 24L17.82 20.18L14 19L17.82 17.82L19 14Z" opacity="0.7"/>
												<path d="M5 2L5.91 4.09L8 5L5.91 5.91L5 8L4.09 5.91L2 5L4.09 4.09L5 2Z" opacity="0.5"/>
											</svg>
										</Link>
									</li>
								)}
							</ul>
						</div>
					</div>
						
				</div>
			</div>
		</div>
		{/* Main Header End */}
		
	{/* SearchBar */}
		<div className="dz-search-area dz-offcanvas offcanvas offcanvas-top" tabIndex={-1} id="offcanvasTop">
			<button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close">
				&times;
			</button>
			<div className="container">
				<form className="header-item-search" action="/shop" method="get">
					<div className="input-group search-input">
						<select name="category" className="default-select">
							<option value="">All Food &amp; Drinks</option>
							<option value="Breakfast">Breakfast</option>
							<option value="Drinks">Drinks</option>
							<option value="Bakery">Bakery</option>
							<option value="Lunch">Lunch</option>
						</select>
						<input name="search" type="search" className="form-control" placeholder="Search food and drinks" />
						<button className="btn" type="submit">
							<i className="iconly-Light-Search"></i>
						</button>
					</div>
					<ul className="recent-tag">
						<li className="pe-0"><span>Quick Search :</span></li>
						<li><Link href="/shop?search=coffee">Coffee</Link></li>
						<li><Link href="/shop?search=bakery">Bakery</Link></li>
						<li><Link href="/shop?search=breakfast">Breakfast</Link></li>
						<li><Link href="/shop?search=dosa">Dosa</Link></li>
					</ul>
				</form>
				<div className="row">
					<div className="col-xl-12">
						<h5 className="mb-3">Popular food and drinks</h5>
						<div className="swiper category-swiper2">
							<div className="swiper-wrapper">
								<div className="swiper-slide">
									<div className="shop-card">
										<div className="dz-media ">
											<img src="/images/products/latte.jpg" alt="Oat milk latte" />
										</div>
										<div className="dz-content">
											<h6 className="title"><Link href="/shop?search=latte">Oat Milk Latte</Link></h6>
											<h6 className="price">$5.75</h6>
										</div>
									</div>
								</div>
								<div className="swiper-slide">
									<div className="shop-card">
										<div className="dz-media ">
											<img src="/images/products/orange-juice.jpg" alt="Fresh orange juice" />
										</div>
										<div className="dz-content">
											<h6 className="title"><Link href="/shop?search=orange">Fresh Orange Juice</Link></h6>
											<h6 className="price">$4.50</h6>
										</div>
									</div>
								</div>
								<div className="swiper-slide">
									<div className="shop-card">
										<div className="dz-media ">
											<img src="/images/products/croissant.jpg" alt="Almond croissant" />
										</div>
										<div className="dz-content">
											<h6 className="title"><Link href="/shop?search=croissant">Almond Croissant</Link></h6>
											<h6 className="price">$4.25</h6>
										</div>
									</div>
								</div>
								<div className="swiper-slide">
									<div className="shop-card">
										<div className="dz-media ">
											<img src="/images/products/blueberry-muffin.jpg" alt="Blueberry muffin" />
										</div>
										<div className="dz-content">
											<h6 className="title"><Link href="/shop?search=muffin">Blueberry Muffin</Link></h6>
											<h6 className="price">$3.75</h6>
										</div>
									</div>
								</div>
								<div className="swiper-slide">
									<div className="shop-card">
										<div className="dz-media ">
											<img src="/images/products/cold-brew.jpg" alt="Signature cold brew" />
										</div>
										<div className="dz-content">
											<h6 className="title"><Link href="/shop?search=cold+brew">Signature Cold Brew</Link></h6>
											<h6 className="price">$5.50</h6>
										</div>
									</div>
								</div>
								<div className="swiper-slide">
									<div className="shop-card">
										<div className="dz-media ">
											<img src="/images/products/cappuccino.jpg" alt="Cappuccino" />
										</div>
										<div className="dz-content">
											<h6 className="title"><Link href="/shop?search=cappuccino">Cappuccino</Link></h6>
											<h6 className="price">$5.50</h6>
										</div>
									</div>
								</div>
								<div className="swiper-slide">
									<div className="shop-card">
										<div className="dz-media ">
											<img src="/images/products/breakfast-platter.jpg" alt="Vegan breakfast platter" />
										</div>
										<div className="dz-content">
											<h6 className="title"><Link href="/shop?search=breakfast">Vegan Breakfast Platter</Link></h6>
											<h6 className="price">$14.50</h6>
										</div>
									</div>
								</div>
								<div className="swiper-slide">
									<div className="shop-card">
										<div className="dz-media ">
											<img src="/images/products/avocado-toast.jpg" alt="Vegan avocado toast" />
										</div>
										<div className="dz-content">
											<h6 className="title"><Link href="/shop?search=avocado">Vegan Avocado Toast</Link></h6>
											<h6 className="price">$8.50</h6>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		{/* SearchBar */}
		
		{/* Sidebar cart */}
		<div className="offcanvas dz-offcanvas offcanvas offcanvas-end " tabIndex={-1} id="offcanvasRight">
			<button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close">
				&times;
			</button>
			<div className="offcanvas-body">
				<div className="product-description">
					<div className="dz-tabs">
						<ul className="nav nav-tabs center" id="myTab" role="tablist">
							<li className="nav-item" role="presentation">
								<button className="nav-link active" id="shopping-cart" data-bs-toggle="tab" data-bs-target="#shopping-cart-pane" type="button" role="tab" aria-controls="shopping-cart-pane" aria-selected="true">Shopping Cart
									<span className="badge badge-light">5</span>
								</button>
							</li>
							<li className="nav-item" role="presentation">
								<button className="nav-link" id="wishlist" data-bs-toggle="tab" data-bs-target="#wishlist-pane" type="button" role="tab" aria-controls="wishlist-pane" aria-selected="false" tabIndex={-1}>Wishlist
									<span className="badge badge-light">2</span>
								</button>
							</li>
						</ul>
						<div className="tab-content pt-4" id="dz-shopcart-sidebar">
							<div className="tab-pane fade show active" id="shopping-cart-pane" role="tabpanel" aria-labelledby="shopping-cart" tabIndex={0}>
								<div className="shop-sidebar-cart">
									<ul className="sidebar-cart-list">
										<li>
											<div className="cart-widget">
												<div className="dz-media me-3">
													<img src="/images/shop/shop-cart/pic1.jpg" alt="" />
												</div>
												<div className="cart-content">
													<h6 className="title"><a href="product-thumbnail.html">Sophisticated Swagger Suit</a></h6>
													<div className="d-flex align-items-center">
														<div className="btn-quantity light quantity-sm me-3">
															<input type="text" defaultValue="1" name="demo_vertical2" />
														</div>
														<h6 className="dz-price mb-0">$50.00</h6>
													</div>
												</div>
												<a href="#" className="dz-close">
													<i className="ti-close"></i>
												</a>
											</div>
										</li>
										<li>
											<div className="cart-widget">
												<div className="dz-media me-3">
													<img src="/images/shop/shop-cart/pic2.jpg" alt="" />
												</div>
												<div className="cart-content">
													<h6 className="title"><a href="product-thumbnail.html">Cozy Knit Cardigan Sweater</a></h6>
													<div className="d-flex align-items-center">
														<div className="btn-quantity light quantity-sm me-3">
															<input type="text" defaultValue="1" name="demo_vertical2" />
														</div>
														<h6 className="dz-price mb-0">$40.00</h6>
													</div>
												</div>
												<a href="#" className="dz-close">
													<i className="ti-close"></i> 
												</a>
											</div>
										</li>
										<li>
											<div className="cart-widget">
												<div className="dz-media me-3">
													<img src="/images/shop/shop-cart/pic3.jpg" alt="" />
												</div>
												<div className="cart-content">
													<h6 className="title"><a href="product-thumbnail.html">Athletic Mesh Sports Leggings</a></h6>
													<div className="d-flex align-items-center">
														<div className="btn-quantity light quantity-sm me-3">
															<input type="text" defaultValue="1" name="demo_vertical2" />
														</div>
														<h6 className="dz-price  mb-0">$65.00</h6>
													</div>
												</div>
												<a href="#" className="dz-close">
													<i className="ti-close"></i>
												</a>
											</div>
										</li>	
									</ul>
									<div className="cart-total">
										<h5 className="mb-0">Subtotal:</h5>
										<h5 className="mb-0">300.00$</h5>
									</div>
									<div className="mt-auto">
										<div className="shipping-time">													
											<div className="dz-icon">
												<i className="flaticon flaticon-ship"></i>
											</div>
											<div className="shipping-content">
												<h6 className="title pe-4">Congratulations , you've got free shipping!</h6>
												<div className="progress">
													<div className="progress-bar progress-animated border-0" style={{width: '75%'}} role="progressbar">
														<span className="sr-only">75% Complete</span>
													</div>
												</div>
											</div>
										</div>
										<a href="shop-checkout.html" className="btn btn-outline-secondary btn-block m-b20">Checkout</a>	
										<a href="shop-cart.html" className="btn btn-secondary btn-block">View Cart</a>	
									</div>	
								</div>	
							</div>
							<div className="tab-pane fade" id="wishlist-pane" role="tabpanel" aria-labelledby="wishlist" tabIndex={0}>
								<div className="shop-sidebar-cart">
									<ul className="sidebar-cart-list">
										<li>
											<div className="cart-widget">
												<div className="dz-media me-3">
													<img src="/images/shop/shop-cart/pic1.jpg" alt="" />
												</div>
												<div className="cart-content">
													<h6 className="title"><a href="product-thumbnail.html">Sophisticated Swagger Suit</a></h6>
													<div className="d-flex align-items-center">
														<h6 className="dz-price  mb-0">$50.00</h6>
													</div>
												</div>
												<a href="#" className="dz-close">
													<i className="ti-close"></i>
												</a>
											</div>
										</li>
										<li>
											<div className="cart-widget">
												<div className="dz-media me-3">
													<img src="/images/shop/shop-cart/pic2.jpg" alt="" />
												</div>
												<div className="cart-content">
													<h6 className="title"><a href="product-thumbnail.html">Cozy Knit Cardigan Sweater</a></h6>
													<div className="d-flex align-items-center">
														<h6 className="dz-price  mb-0">$40.00</h6>
													</div>
												</div>
												<a href="#" className="dz-close">
													<i className="ti-close"></i> 
												</a>
											</div>
										</li>
										<li>
											<div className="cart-widget">
												<div className="dz-media me-3">
													<img src="/images/shop/shop-cart/pic3.jpg" alt="" />
												</div>
												<div className="cart-content">
													<h6 className="title"><a href="product-thumbnail.html">Athletic Mesh Sports Leggings</a></h6>
													<div className="d-flex align-items-center">
														<h6 className="dz-price  mb-0">$65.00</h6>
													</div>
												</div>
												<a href="#" className="dz-close">
													<i className="ti-close"></i>
												</a>
											</div>
										</li>	
									</ul>
									<div className="mt-auto">
										<a href="shop-wishlist.html" className="btn btn-secondary btn-block">Check Your Favourite</a>
									</div>	
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		{/* Sidebar cart */}

		{/* Sidebar finter */}
		<div className="offcanvas dz-offcanvas offcanvas offcanvas-end " tabIndex={-1} id="offcanvasLeft">
			<button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close">
				&times;
			</button>
			<div className="offcanvas-body">
				<div className="product-description">
					<div className="widget widget_search">
						<div className="form-group">
							<form className="input-group" action="/shop" method="get">
								<input name="search" type="search" className="form-control" placeholder="Search food and drinks" />
								<div className="input-group-addon">
									<button name="submit" value="Submit" type="submit" className="btn">
										<i className="icon feather icon-search"></i>
									</button>
								</div>
							</form>
						</div>
					</div>
					<div className="widget">
						<h6 className="widget-title">Price</h6>
						<div className="price-slide range-slider">
							<div className="price">
								<div className="range-slider style-1">
									<div id="slider-tooltips" className="mb-3"></div>
									<span className="example-val" id="slider-margin-value-min"></span>
									<span className="example-val" id="slider-margin-value-max"></span>
								</div>
							</div>
						</div>
					</div>
					<div className="widget">
						<h6 className="widget-title">Color</h6>
						<div className="d-flex align-items-center flex-wrap color-filter ps-2">
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel1" value="#000000" aria-label="..." defaultChecked />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel2" value="#9BD1FF" aria-label="..." />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel3" value="#21B290" aria-label="..." />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel4" value="#FEC4C4" aria-label="..." />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel5" value="#FF7354" aria-label="..." />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel6" value="#51EDC8" aria-label="..." />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel7" value="#B77CF3" aria-label="..." />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel8" value="#FF4A76" aria-label="..." />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabel9" value="#3E68FF" aria-label="..." />
								<span></span>
							</div>
							<div className="form-check">
								<input className="form-check-input" type="radio" name="radioNoLabel" id="radioNoLabe20" value="#7BEF68" aria-label="..." />
								<span></span>
							</div>
						</div>
					</div>
					<div className="widget">
						<h6 className="widget-title">Size</h6>
						<div className="btn-group product-size">
							<input type="radio" className="btn-check" name="btnradio1" id="btnradio11" defaultChecked />
							<label className="btn" htmlFor="btnradio11">4</label>

							<input type="radio" className="btn-check" name="btnradio1" id="btnradio21" />
							<label className="btn" htmlFor="btnradio21">6</label>

							<input type="radio" className="btn-check" name="btnradio1" id="btnradio31" />
							<label className="btn" htmlFor="btnradio31">8</label>
						  
							<input type="radio" className="btn-check" name="btnradio1" id="btnradio41" />
							<label className="btn" htmlFor="btnradio41">10</label>
							
							<input type="radio" className="btn-check" name="btnradio1" id="btnradio51" />
							<label className="btn" htmlFor="btnradio51">12</label>
							
							<input type="radio" className="btn-check" name="btnradio1" id="btnradio61" />
							<label className="btn" htmlFor="btnradio61">14</label>
							
							<input type="radio" className="btn-check" name="btnradio1" id="btnradio71" />
							<label className="btn" htmlFor="btnradio71">16</label>
							
							<input type="radio" className="btn-check" name="btnradio1" id="btnradio81" />
							<label className="btn" htmlFor="btnradio81">18</label>
							
							<input type="radio" className="btn-check" name="btnradio1" id="btnradio91" />
							<label className="btn" htmlFor="btnradio91">20</label>
						</div>
					</div>
					<div className="widget widget_categories">
						<h6 className="widget-title">Category</h6>
						<ul>
							<li className="cat-item cat-item-26"><a href="blog-category.html">Dresses</a> (10)</li>
							<li className="cat-item cat-item-36"><a href="blog-category.html">Top &amp; Blouses</a> (5)</li>
							<li className="cat-item cat-item-43"><a href="blog-category.html">Boots</a> (17)</li>
							<li className="cat-item cat-item-27"><a href="blog-category.html">Jewelry</a> (13)</li>
							<li className="cat-item cat-item-40"><a href="blog-category.html">Makeup</a> (06)</li> 
							<li className="cat-item cat-item-40"><a href="blog-category.html">Fragrances</a> (17)</li> 
							<li className="cat-item cat-item-40"><a href="blog-category.html">Shaving &amp; Grooming</a> (13)</li> 
							<li className="cat-item cat-item-43"><a href="blog-category.html">Jacket</a> (06)</li> 
							<li className="cat-item cat-item-36"><a href="blog-category.html">Coat</a> (22)</li> 
						</ul>
					</div>
					<div className="widget widget_tag_cloud">
						<h6 className="widget-title">Tags</h6>
						<div className="tagcloud"> 
							<a href="blog-tag.html">Vintage </a>
							<a href="blog-tag.html">Wedding</a>
							<a href="blog-tag.html">Cotton</a>
							<a href="blog-tag.html">Linen</a>
							<a href="blog-tag.html">Navy</a>
							<a href="blog-tag.html">Urban</a>
							<a href="blog-tag.html">Business Meeting</a>
							<a href="blog-tag.html">Formal</a>
						</div>
					</div>
					<a href="#" className="btn btn-sm font-14 btn-secondary btn-sharp">RESET</a>
				</div>
			</div>
		</div>
		{/* filter sidebar */}
	</header>
  );
}
