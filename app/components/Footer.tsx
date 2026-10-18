'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer bg-light">
      <div className="footer-top">
        <div className="container">
          <div className="row">
            <div className="col-xl-3 col-md-4 col-sm-6 wow fadeInUp" data-wow-delay="0.1s">
              <div className="widget widget_about me-2">
                <div className="footer-logo logo-dark">
                  <Link href="/"><img src="/images/logo.svg" alt="Loopora" /></Link>
                </div>
                <ul className="widget-address">
                  <li><p><span>Address</span> : HITEC City, Madhapur, Hyderabad, Telangana 500081</p></li>
                  <li><p><span>E-mail</span> : support@agenticcheckout.in</p></li>
                  <li><p><span>Phone</span> : +91 40 1234 5678</p></li>
                </ul>
                <div className="subscribe_widget">
                  <h6 className="title fw-medium text-capitalize">subscribe to our newsletter</h6>
                  <form className="dzSubscribe style-1" onSubmit={(e) => e.preventDefault()}>
                    <div className="form-group">
                      <div className="input-group mb-0">
                        <input name="dzEmail" required type="email" className="form-control" placeholder="Your Email Address" />
                        <div className="input-group-addon">
                          <button name="submit" value="Submit" type="submit" className="btn">
                            <i className="icon feather icon-arrow-right"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-xl-3 col-md-4 col-sm-6 wow fadeInUp" data-wow-delay="0.2s">
              <div className="widget widget_post">
                <h5 className="footer-title">Recent Posts</h5>
                <ul>
                  <li><div className="dz-media"><img src="/images/shop/product/small/1.png" alt="" /></div><div className="dz-content"><h6 className="name"><a href="post-standard.html">Cozy Knit Cardigan Sweater</a></h6><span className="time">July 23, 2024</span></div></li>
                  <li><div className="dz-media"><img src="/images/shop/product/small/2.png" alt="" /></div><div className="dz-content"><h6 className="name"><a href="post-standard.html">Sophisticated Swagger Suit</a></h6><span className="time">July 23, 2024</span></div></li>
                  <li><div className="dz-media"><img src="/images/shop/product/small/3.png" alt="" /></div><div className="dz-content"><h6 className="name"><a href="post-standard.html">Athletic Mesh Sports Leggings</a></h6><span className="time">July 23, 2024</span></div></li>
                </ul>
              </div>
            </div>
            <div className="col-xl-2 col-md-3 col-sm-4 col-6 wow fadeInUp" data-wow-delay="0.3s">
              <div className="widget widget_services">
                <h5 className="footer-title">Our Stores</h5>
                <ul><li><a href="#">Hyderabad</a></li><li><a href="#">Bangalore</a></li><li><a href="#">Mumbai</a></li><li><a href="#">Delhi</a></li><li><a href="#">Chennai</a></li><li><a href="#">Pune</a></li></ul>
              </div>
            </div>
            <div className="col-xl-2 col-md-3 col-sm-4 col-6 wow fadeInUp" data-wow-delay="0.4s">
              <div className="widget widget_services">
                <h5 className="footer-title">Useful Links</h5>
                <ul><li><a href="#">Privacy Policy</a></li><li><a href="#">Returns</a></li><li><a href="#">Terms & Conditions</a></li><li><a href="#">Contact Us</a></li><li><a href="#">Latest News</a></li><li><a href="#">Our Sitemap</a></li></ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <div className="row fb-inner wow fadeInUp" data-wow-delay="0.1s">
            <div className="col-lg-6 col-md-12 text-start">
              <p className="copyright-text">© <span className="current-year">2026</span> Loopora. All Rights Reserved.</p>
            </div>
            <div className="col-lg-6 col-md-12 text-end">
              <div className="d-flex align-items-center justify-content-center justify-content-md-center justify-content-xl-end">
                <span className="me-3">We Accept: </span>
                <img src="/images/footer-img.png" alt="Accepted payment methods" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
