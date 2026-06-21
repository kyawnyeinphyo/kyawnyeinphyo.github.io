$(document).ready(function() {
  // 1. Particle Smoke Background
  const canvas = document.getElementById('smoke-canvas');
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  
  window.addEventListener('resize', function() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });
  
  class Particle {
    constructor() {
      this.reset();
    }
    
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height + height; // Start below screen or randomly
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = -(Math.random() * 0.8 + 0.2);
      this.radius = Math.random() * 80 + 40;
      this.alpha = 0;
      this.targetAlpha = Math.random() * 0.15 + 0.05;
      this.fadeSpeed = Math.random() * 0.005 + 0.002;
      this.color = Math.random() > 0.4 ? '80, 200, 120' : '0, 210, 211'; // green vs blue
    }
    
    update() {
      this.x += this.vx;
      this.y += this.vy;
      
      if (this.alpha < this.targetAlpha) {
        this.alpha += this.fadeSpeed;
      }
      
      // Reset if particle moves off top or sides
      if (this.y < -this.radius || this.x < -this.radius || this.x > width + this.radius) {
        this.reset();
        this.y = height + this.radius;
      }
    }
    
    draw() {
      ctx.beginPath();
      let gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      gradient.addColorStop(0, `rgba(${this.color}, ${this.alpha})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  const particles = [];
  const particleCount = 35;
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }
  
  function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }
  animate();

  // 2. Intro Splash Overlay Dismissal
  $('#btn-enter').on('click', function() {
    // Reset scroll to top
    window.scrollTo(0, 0);

    const audio = new Audio('breaking-bad-intro.mp3');
    audio.play().catch(function(error) {
      console.log("Audio play prevented: ", error);
    });

    $('.intro-overlay').css({
      'opacity': 0,
      'visibility': 'hidden'
    });
  });

  // 3. Periodic Table of Skills Data & Interaction
  const skillsData = {
    'Fl': {
      name: 'Flutter',
      category: 'flutter',
      desc: 'Expertise in building scalable, cross-platform applications (iOS, Android, Web, Desktop) with 8+ years of experience. Master of advanced state management libraries including BLoC, Provider, GetX, and Riverpod.'
    },
    'Da': {
      name: 'Dart',
      category: 'flutter',
      desc: 'Deep proficiency in Dart programming language. Skilled in structural coding, asynchronous programming (Streams/Futures), memory safety, and native compilation optimizations.'
    },
    'La': {
      name: 'Laravel',
      category: 'backend',
      desc: 'Highly experienced in PHP and Laravel framework. Capable of developing robust REST APIs, administrative management panels, and handling database schema migrations.'
    },
    'Ph': {
      name: 'PHP',
      category: 'backend',
      desc: 'Back-end development skill set. Clean coding conforming to modern PSR standards, integrating external payment gateways, socket triggers, and administration controllers.'
    },
    'Jv': {
      name: 'Java',
      category: 'backend',
      desc: 'Strong core Java knowledge. Utilized during custom Android SDK integrations and early Android mobile development cycles.'
    },
    'Cs': {
      name: 'C# .NET',
      category: 'backend',
      desc: 'Developed robust business enterprise applications (WinForms) for Windows systems, integrating MSSQL server databases for POS, Inventory, and Real-Estate management platforms.'
    },
    'Py': {
      name: 'Python',
      category: 'backend',
      desc: 'Scripting automation, database batch updates, and custom background processing scripts.'
    },
    'Js': {
      name: 'Javascript',
      category: 'backend',
      desc: 'Interactive front-end operations, jQuery workflows, Node.js scripts, and API integrations.'
    },
    'Fb': {
      name: 'Firebase',
      category: 'tools',
      desc: 'Integrating analytics, crash reporting, Cloud Firestore, Cloud Functions, and Firebase Push Notification channels in mobile applications.'
    },
    'Sq': {
      name: 'SQL Databases',
      category: 'backend',
      desc: 'Experienced in MSSQL Server, MySQL Server, and local relational SQLite databases. Proficient in database performance tuning and writing complex query scripts.'
    },
    'Gi': {
      name: 'Git / GitHub',
      category: 'tools',
      desc: 'Version control system management, branch structures, merging conflict resolutions, and project deployment releases.'
    },
    'Fv': {
      name: 'FVM',
      category: 'flutter',
      desc: 'Utilizing Flutter Version Manager to handle multiple active SDK channels across projects, ensuring environment compliance.'
    },
    'Ap': {
      name: 'App Publishing',
      category: 'tools',
      desc: 'End-to-end publishing, building, signing, and releasing native bundles to Google Play Store and Apple App Store, conforming to store guideline standards.'
    },
    'Se': {
      name: 'Linux Server',
      category: 'tools',
      desc: 'Deployment, virtual private server management, bash commands, cron schedule setups, and API backend hosting environments.'
    },
    'Fi': {
      name: 'Figma UI/UX',
      category: 'tools',
      desc: 'Reviewing, sketching, and transforming vector UI designs directly into fluid code components.'
    },
    'An': {
      name: 'Animation UI',
      category: 'flutter',
      desc: 'Creating interactive user interfaces using custom controller animations, physics animations, and vector transitions.'
    },
    'Co': {
      name: 'Custom Painter',
      category: 'flutter',
      desc: 'Designing and programming customized visual graphs, responsive icons, and advanced interactive canvases using Flutter Canvas APIs.'
    }
  };

  $('.periodic-element').on('click', function() {
    $('.periodic-element').removeClass('active');
    $(this).addClass('active');
    
    const symbol = $(this).find('.elem-sym').text();
    const data = skillsData[symbol];
    
    if (data) {
      const display = $('.skill-details-display');
      display.removeClass('flutter backend tools');
      display.addClass(data.category);
      
      display.find('h4').text(`${data.name} [${symbol}]`);
      display.find('.category-tag').text(data.category === 'flutter' ? 'Flutter / Mobile' : data.category === 'backend' ? 'Backend / Language' : 'Utility / Integration');
      display.find('p').text(data.desc);
    }
  });

  // 4. Saul's Burner Phone Simulator Form Logic
  let inputState = 'name'; // name -> email -> message -> ready
  let contactData = { name: '', email: '', message: '' };

  function updatePhoneScreen() {
    const body = $('.screen-body');
    if (inputState === 'name') {
      body.html(`
        <p>> ENTER SENDER ALIAS:</p>
        <input type="text" id="phone-input-name" placeholder="Who's cooking?" autocomplete="off" value="${contactData.name}" />
        <p style="font-size: 0.65rem; color: #8fa08f;">Press Green button to next</p>
      `);
      $('#phone-input-name').focus();
    } else if (inputState === 'email') {
      body.html(`
        <p>> ENCRYPTED EMAIL RECIPIENT:</p>
        <input type="email" id="phone-input-email" placeholder="email@domain.com" autocomplete="off" value="${contactData.email}" />
        <p style="font-size: 0.65rem; color: #8fa08f;">Press Green to next / Red to back</p>
      `);
      $('#phone-input-email').focus();
    } else if (inputState === 'message') {
      body.html(`
        <p>> ENTER SECURE MESSAGE:</p>
        <textarea id="phone-input-msg" placeholder="Your business proposal..." rows="3">${contactData.message}</textarea>
        <p style="font-size: 0.65rem; color: #8fa08f;">Press Green to call / Red to back</p>
      `);
      $('#phone-input-msg').focus();
    } else if (inputState === 'sending') {
      body.html(`
        <div style="text-align: center; margin-top: 15px;">
          <p class="blink">DIALING HEISENBERG...</p>
          <p style="font-size: 0.7rem; margin-top: 10px;">ESTABLISHING CORNER...</p>
          <p style="font-size: 0.65rem; color: #8fa08f;">Wait for patch...</p>
        </div>
      `);
      setTimeout(function() {
        inputState = 'success';
        updatePhoneScreen();
      }, 2000);
    } else if (inputState === 'success') {
      body.html(`
        <div style="text-align: center; margin-top: 10px;">
          <p style="color: #f1c40f;">TRANSMISSION RECEIVED</p>
          <p style="font-size: 0.7rem; margin-top: 8px;">Message Purity: 99.1%</p>
          <p style="font-size: 0.65rem; color: #8fa08f; margin-top: 10px;">Burner cleared.</p>
          <button id="phone-btn-reset" style="background: transparent; border: 1px solid var(--neon-green); color: var(--neon-green); font-family: var(--font-mono); padding: 3px 8px; margin-top: 10px; cursor: pointer;">NEW CALL</button>
        </div>
      `);
    }
  }

  // Keypad simulation
  $('.phone-btn').on('click', function() {
    const val = $(this).find('.num').text();
    
    // Play a click sound effect if supported, or visual feedback
    $(this).addClass('active');
    setTimeout(() => $(this).removeClass('active'), 100);

    if ($(this).hasClass('action-call')) {
      // Green button -> Next state
      if (inputState === 'name') {
        const valName = $('#phone-input-name').val();
        if (valName.trim()) {
          contactData.name = valName;
          inputState = 'email';
          updatePhoneScreen();
        }
      } else if (inputState === 'email') {
        const valEmail = $('#phone-input-email').val();
        if (valEmail.trim() && valEmail.includes('@')) {
          contactData.email = valEmail;
          inputState = 'message';
          updatePhoneScreen();
        }
      } else if (inputState === 'message') {
        const valMsg = $('#phone-input-msg').val();
        if (valMsg.trim()) {
          contactData.message = valMsg;
          inputState = 'sending';
          updatePhoneScreen();
        }
      }
    } else if ($(this).hasClass('action-end')) {
      // Red button -> Back state or Reset
      if (inputState === 'email') {
        inputState = 'name';
        updatePhoneScreen();
      } else if (inputState === 'message') {
        inputState = 'email';
        updatePhoneScreen();
      } else {
        // Reset everything
        inputState = 'name';
        contactData = { name: '', email: '', message: '' };
        updatePhoneScreen();
      }
    }
  });

  // Handle inputs
  $(document).on('keydown', '#phone-input-name, #phone-input-email, #phone-input-msg', function(e) {
    if (e.key === 'Enter' && e.target.id !== 'phone-input-msg') {
      e.preventDefault();
      $('.action-call').click();
    }
  });

  $(document).on('click', '#phone-btn-reset', function() {
    inputState = 'name';
    contactData = { name: '', email: '', message: '' };
    updatePhoneScreen();
  });

  // Start phone
  updatePhoneScreen();
});
